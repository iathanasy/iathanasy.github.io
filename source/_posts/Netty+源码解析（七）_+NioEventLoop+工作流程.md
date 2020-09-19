---
name: netty-part-7
title: Netty 源码解析（七）- NioEventLoop 工作流程
date: 2020-09-19 12:50:09
tags: [Java,Netty]
categories: 
---
Netty 源码分析系列：

[Netty 源码解析（一）: 开始](/post/netty-part-1)

[Netty 源码解析（二）: Netty 的 Channel](/post/netty-part-2)

[Netty 源码解析（三）: Netty 的 Future 和 Promise](/post/netty-part-3)

[Netty 源码解析（四）: Netty 的 ChannelPipeline](/post/netty-part-4)

[Netty 源码解析（五）: Netty 的线程池分析](/post/netty-part-5)

[Netty 源码解析（六）: Channel 的 register 操作](/post/netty-part-6)

当前 => Netty 源码解析（七）: NioEventLoop 工作流程

[Netty 源码解析（八）: 回到 Channel 的 register 操作](/post/netty-part-8)

[Netty 源码解析（九）: connect 过程和 bind 过程分析](/post/netty-part-9)

## NioEventLoop 工作流程

前面，我们在分析线程池的实例化的时候说过，NioEventLoop 中并没有启动 Java 线程。这里我们来仔细分析下在 register 过程中调用的 **eventLoop.execute(runnable)** 这个方法，这个代码在父类 SingleThreadEventExecutor 中：

```java
@Override
public void execute(Runnable task) {
    if (task == null) {
        throw new NullPointerException("task");
    }
	// 判断添加任务的线程是否就是当前 EventLoop 中的线程
    boolean inEventLoop = inEventLoop();
    
    // 添加任务到之前介绍的 taskQueue 中，
    // 	如果 taskQueue 满了(默认大小 16)，根据我们之前说的，默认的策略是抛出异常
    addTask(task);
    
    if (!inEventLoop) {
        // 如果不是 NioEventLoop 内部线程提交的 task，那么判断下线程是否已经启动，没有的话，就启动线程
        startThread();
        if (isShutdown() && removeTask(task)) {
            reject();
        }
    }

    if (!addTaskWakesUp && wakesUpForTask(task)) {
        wakeup(inEventLoop);
    }
}
```

> 原来启动 NioEventLoop 中的线程的方法在这里。
>
> 另外，上节我们说的 register 操作进到了 taskQueue 中，所以它其实是被归类到了非 IO 操作的范畴。

下面是 startThread 的源码，判断线程是否已经启动来决定是否要进行启动操作：

```java
private void startThread() {
    if (state == ST_NOT_STARTED) {
        if (STATE_UPDATER.compareAndSet(this, ST_NOT_STARTED, ST_STARTED)) {
            try {
                doStartThread();
            } catch (Throwable cause) {
                STATE_UPDATER.set(this, ST_NOT_STARTED);
                PlatformDependent.throwException(cause);
            }
        }
    }
}
```

我们按照前面的思路，根据线程没有启动的情况，来看看 doStartThread() 方法：

```java
private void doStartThread() {
    assert thread == null;
    // 这里的 executor 大家是不是有点熟悉的感觉，它就是一开始我们实例化 NioEventLoop 的时候传进来的 ThreadPerTaskExecutor 的实例。它是每次来一个任务，创建一个线程的那种 executor。
    // 一旦我们调用它的 execute 方法，它就会创建一个新的线程，所以这里终于会创建 Thread 实例
    executor.execute(new Runnable() {
        @Override
        public void run() {
            // 看这里，将 “executor” 中创建的这个线程设置为 NioEventLoop 的线程！！！
            thread = Thread.currentThread();
            
            if (interrupted) {
                thread.interrupt();
            }

            boolean success = false;
            updateLastExecutionTime();
            try {
                // 执行 SingleThreadEventExecutor 的 run() 方法，它在 NioEventLoop 中实现了
                SingleThreadEventExecutor.this.run();
                success = true;
            } catch (Throwable t) {
                logger.warn("Unexpected exception from an event executor: ", t);
            } finally {
                // ... 我们直接忽略掉这里的代码
            }
        }
    });
}
```

上面线程启动以后，会执行 NioEventLoop 中的 run() 方法，这是一个**非常重要**的方法，这个方法肯定是没那么容易结束的，必然是像 JDK 线程池的 Worker 那样，不断地循环获取新的任务的。它需要不断地做 select 操作和轮询 taskQueue 这个队列。

我们先来简单地看一下它的源码，这里先不做深入地介绍：

```java
@Override
protected void run() {
    // 代码嵌套在 for 循环中
    for (;;) {
        try {
            // selectStrategy 终于要派上用场了
            // 它有两个值，一个是 CONTINUE 一个是 SELECT
            // 针对这块代码，我们分析一下。
            // 1. 如果 taskQueue 不为空，也就是 hasTasks() 返回 true，
            // 		那么执行一次 selectNow()，该方法不会阻塞
            // 2. 如果 hasTasks() 返回 false，那么执行 SelectStrategy.SELECT 分支，
            //    进行 select(...)，这块是带阻塞的
            // 这个很好理解，就是按照是否有任务在排队来决定是否可以进行阻塞
            switch (selectStrategy.calculateStrategy(selectNowSupplier, hasTasks())) {
                case SelectStrategy.CONTINUE:
                    continue;
                case SelectStrategy.SELECT:
                    // 如果 !hasTasks()，那么进到这个 select 分支，这里 select 带阻塞的
                    select(wakenUp.getAndSet(false));
                    if (wakenUp.get()) {
                        selector.wakeup();
                    }
                default:
            }
            
            
            cancelledKeys = 0;
            needsToSelectAgain = false;
            // 默认地，ioRatio 的值是 50
            final int ioRatio = this.ioRatio;
            
            if (ioRatio == 100) {
                // 如果 ioRatio 设置为 100，那么先执行 IO 操作，然后在 finally 块中执行 taskQueue 中的任务
                try {
                    // 1. 执行 IO 操作。因为前面 select 以后，可能有些 channel 是需要处理的。
                    processSelectedKeys();
                } finally {
                    // 2. 执行非 IO 任务，也就是 taskQueue 中的任务
                    runAllTasks();
                }
            } else {
                // 如果 ioRatio 不是 100，那么根据 IO 操作耗时，限制非 IO 操作耗时
                final long ioStartTime = System.nanoTime();
                try {
                    // 执行 IO 操作
                    processSelectedKeys();
                } finally {
                    // 根据 IO 操作消耗的时间，计算执行非 IO 操作（runAllTasks）可以用多少时间.
                    final long ioTime = System.nanoTime() - ioStartTime;
                    runAllTasks(ioTime * (100 - ioRatio) / ioRatio);
                }
            }
        } catch (Throwable t) {
            handleLoopException(t);
        }
        // Always handle shutdown even if the loop processing threw an exception.
        try {
            if (isShuttingDown()) {
                closeAll();
                if (confirmShutdown()) {
                    return;
                }
            }
        } catch (Throwable t) {
            handleLoopException(t);
        }
    }
}
```

上面这段代码是 NioEventLoop 的核心，这里介绍两点：

1. 首先，会根据 hasTasks() 的结果来决定是执行 selectNow() 还是 select(oldWakenUp)，这个应该好理解。如果有任务正在等待，那么应该使用无阻塞的 selectNow()，如果没有任务在等待，那么就可以使用带阻塞的 select 操作。
2. ioRatio 控制 IO 操作所占的时间比重：
   - 如果设置为 100%，那么先执行 IO 操作，然后再执行任务队列中的任务。
   - 如果不是 100%，那么先执行 IO 操作，然后执行 taskQueue 中的任务，但是需要控制执行任务的总时间。也就是说，非 IO 操作可以占用的时间，通过 ioRatio 以及这次 IO 操作耗时计算得出。

我们这里先不要去关心 select(oldWakenUp)、processSelectedKeys() 方法和 runAllTasks(…) 方法的细节，只要先理解它们分别做什么事情就可以了。

回过神来，我们前面在 register 的时候提交了 register 任务给 NioEventLoop，这是 NioEventLoop 接收到的第一个任务，所以这里会实例化 Thread 并且启动，然后进入到 NioEventLoop 中的 run 方法。

> 当然了，实际情况可能是，Channel 实例被 register 到一个已经启动线程的 NioEventLoop 实例中。