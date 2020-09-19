---
name: netty-part-5
title: Netty 源码解析（五）- Netty 的线程池分析
date: 2020-09-19 12:50:03
tags: [Java,Netty]
categories: 
---
Netty 源码分析系列：

[Netty 源码解析（一）: 开始](/post/netty-part-1)

[Netty 源码解析（二）: Netty 的 Channel](/post/netty-part-2)

[Netty 源码解析（三）: Netty 的 Future 和 Promise](/post/netty-part-3)

[Netty 源码解析（四）: Netty 的 ChannelPipeline](/post/netty-part-4)

当前 => Netty 源码解析（五）: Netty 的线程池分析

[Netty 源码解析（六）: Channel 的 register 操作](/post/netty-part-6)

[Netty 源码解析（七）: NioEventLoop 工作流程](/post/netty-part-7)

[Netty 源码解析（八）: 回到 Channel 的 register 操作](/post/netty-part-8)

[Netty 源码解析（九）: connect 过程和 bind 过程分析](/post/netty-part-9)

## Netty 中的线程池 EventLoopGroup

接下来，我们来分析 Netty 中的线程池。Netty 中的线程池比较不好理解，因为它的类比较多，而且它们之间的关系错综复杂。看下图，感受下 NioEventLoop 类和 NioEventLoopGroup 类的继承结构：

![2](https://www.javadoop.com/blogimages/netty-source/2.png)

这张图我按照继承关系整理而来，大家仔细看一下就会发现，涉及到的类确实挺多的。本节来给大家理理清楚这部分内容。

首先，我们说的 Netty 的线程池，指的就是 **NioEventLoopGroup** 的实例；线程池中的单个线程，指的是右边 **NioEventLoop** 的实例。

回顾下我们第一节介绍的 Echo 例子，客户端和服务端的启动代码中，最开始我们总是先实例化 NioEventLoopGroup：

```java
// EchoClient 代码最开始：
EventLoopGroup group = new NioEventLoopGroup();

// EchoServer 代码最开始：
EventLoopGroup bossGroup = new NioEventLoopGroup(1);
EventLoopGroup workerGroup = new NioEventLoopGroup();
```

下面，我们就从 NioEventLoopGroup 的源码开始进行分析。

我们打开 NioEventLoopGroup 的源码，可以看到，NioEventLoopGroup 有多个构造方法用于参数设置，最简单地，我们采用无参构造函数，或仅仅设置线程数量就可以了，其他的参数采用默认值。

> 比如上面的代码中，我们只在实例化 bossGroup 的时候指定了参数，代表该线程池需要一个线程。

```java
public NioEventLoopGroup() {
    this(0);
}
public NioEventLoopGroup(int nThreads) {
    this(nThreads, (Executor) null);
}

...
  
// 参数最全的构造方法
public NioEventLoopGroup(int nThreads, Executor executor, EventExecutorChooserFactory chooserFactory,
                         final SelectorProvider selectorProvider,
                         final SelectStrategyFactory selectStrategyFactory,
                         final RejectedExecutionHandler rejectedExecutionHandler) {
    // 调用父类的构造方法
    super(nThreads, executor, chooserFactory, selectorProvider, selectStrategyFactory, rejectedExecutionHandler);
}
```

我们来稍微看一下构造方法中的各个参数：

- nThreads：这个最简单，就是线程池中的线程数，也就是 NioEventLoop 的实例数量。
- executor：我们知道，我们本身就是要构造一个线程池（Executor），为什么这里传一个 executor 实例呢？它其实不是给线程池用的，而是给 NioEventLoop 用的，以后再说。
- chooserFactory：当我们提交一个任务到线程池的时候，线程池需要选择（choose）其中的一个线程来执行这个任务，这个就是用来实现选择策略的。
- selectorProvider：这个简单，我们需要通过它来实例化 JDK 的 Selector，可以看到每个线程池都持有一个 selectorProvider 实例。
- selectStrategyFactory：这个涉及到的是线程池中线程的工作流程，在介绍 NioEventLoop 的时候会说。
- rejectedExecutionHandler：这个也是线程池的好朋友了，用于处理线程池中没有可用的线程来执行任务的情况。在 Netty 中稍微有一点点不一样，这个是给 NioEventLoop 实例用的，以后我们再详细介绍。

这里介绍这些参数是希望大家有个印象而已，大家发现没有，在构造 NioEventLoopGroup 实例时的好几个参数，都是用来构造 NioEventLoop 用的。

下面，我们从 NioEventLoopGroup 的无参构造方法开始，跟着源码走：

```java
public NioEventLoopGroup() {
    this(0);
}
```

然后一步步走下去，到这个构造方法：

```java
public NioEventLoopGroup(int nThreads, ThreadFactory threadFactory, final SelectorProvider selectorProvider, final SelectStrategyFactory selectStrategyFactory) {
    
    super(nThreads, threadFactory, selectorProvider, selectStrategyFactory, RejectedExecutionHandlers.reject());
}
```

大家自己要去跟一下源码，这样才知道中间设置了哪些默认值，下面这几个参数都被设置了默认值： 

- selectorProvider = SelectorProvider.provider()

  > 这个没什么好说的，调用了 JDK 提供的方法

- selectStrategyFactory = DefaultSelectStrategyFactory.INSTANCE

  > 这个涉及到的是线程在做 select 操作和执行任务过程中的策略选择问题，在介绍 NioEventLoop 的时候会用到。 

- rejectedExecutionHandler = RejectedExecutionHandlers.reject()

  > 大家进去看一下 reject() 方法，也就是说，Netty 选择的默认拒绝策略是：抛出异常

跟着源码走，我们会来到父类 MultithreadEventLoopGroup 的构造方法中：

```java
protected MultithreadEventLoopGroup(int nThreads, ThreadFactory threadFactory, Object... args) {
    super(nThreads == 0 ? DEFAULT_EVENT_LOOP_THREADS : nThreads, threadFactory, args);
}
```

这里我们发现，如果采用无参构造函数，那么到这里的时候，默认地 nThreads 会被设置为 **CPU 核心数 *2**。大家可以看下 DEFAULT_EVENT_LOOP_THREADS 的默认值，以及 static 代码块的设值逻辑。

我们继续往下走：

```java
protected MultithreadEventExecutorGroup(int nThreads, ThreadFactory threadFactory, Object... args) {
    this(nThreads, threadFactory == null ? null : new ThreadPerTaskExecutor(threadFactory), args);
}
```

到这一步的时候，`new ThreadPerTaskExecutor(threadFactory)` 会构造一个 executor。

> 我们现在还不知道这个 executor 怎么用。这里我们先看下它的源码：
>
> ```java
> public final class ThreadPerTaskExecutor implements Executor {
>     private final ThreadFactory threadFactory;
> 
>     public ThreadPerTaskExecutor(ThreadFactory threadFactory) {
>         if (threadFactory == null) {
>             throw new NullPointerException("threadFactory");
>         }
>         this.threadFactory = threadFactory;
>     }
> 
>     @Override
>     public void execute(Runnable command) {
>         // 为每个任务新建一个线程
>         threadFactory.newThread(command).start();
>     }
> }
> ```
>
> Executor 作为线程池的最顶层接口， 我们知道，它只有一个 execute(runnable) 方法，从上面我们可以看到，实现类 ThreadPerTaskExecutor 的逻辑就是**每来一个任务，新建一个线程**。
>
> 我们先记住这个，前面也说了，它是给 NioEventLoop 用的，不是给 NioEventLoopGroup 用的。

上一步设置完了 executor，我们继续往下看：

```java
protected MultithreadEventExecutorGroup(int nThreads, Executor executor, Object... args) {
    this(nThreads, executor, DefaultEventExecutorChooserFactory.INSTANCE, args);
}
```

这一步设置了 chooserFactory，用来实现从线程池中选择一个线程的选择策略。

> ChooserFactory 的逻辑比较简单，我们看下 DefaultEventExecutorChooserFactory 的实现：
>
> ```java
> @Override
> public EventExecutorChooser newChooser(EventExecutor[] executors) {
>     if (isPowerOfTwo(executors.length)) {
>         return new PowerOfTwoEventExecutorChooser(executors);
>     } else {
>         return new GenericEventExecutorChooser(executors);
>     }
> }
> ```
>
> 这里设置的策略也很简单：
>
> 1、如果线程池的线程数量是 2^n，采用下面的方式会高效一些：
>
> ```java
> @Override
> public EventExecutor next() {
>     return executors[idx.getAndIncrement() & executors.length - 1];
> }
> ```
>
> 2、如果不是，用取模的方式：
>
> ```java
> @Override
> public EventExecutor next() {
>     return executors[Math.abs(idx.getAndIncrement() % executors.length)];
> }
> ```

走了这么久，我们终于到了一个**干实事**的构造方法中了：

```java
protected MultithreadEventExecutorGroup(int nThreads, Executor executor,
                                        EventExecutorChooserFactory chooserFactory, Object... args) {
    if (nThreads <= 0) {
        throw new IllegalArgumentException(String.format("nThreads: %d (expected: > 0)", nThreads));
    }

    // executor 如果是 null，做一次和前面一样的默认设置。
    if (executor == null) {
        executor = new ThreadPerTaskExecutor(newDefaultThreadFactory());
    }

    // 这里的 children 数组非常重要，它就是线程池中的线程数组，这么说不太严谨，但是就大概这个意思
    children = new EventExecutor[nThreads];

    // 下面这个 for 循环将实例化 children 数组中的每一个元素
    for (int i = 0; i < nThreads; i ++) {
        boolean success = false;
        try {
            // 实例化！！！！！！
            children[i] = newChild(executor, args);
            success = true;
        } catch (Exception e) {
            // TODO: Think about if this is a good exception type
            throw new IllegalStateException("failed to create a child event loop", e);
        } finally {
            // 如果有一个 child 实例化失败，那么 success 就会为 false，然后进入下面的失败处理逻辑
            if (!success) {
                // 把已经成功实例化的“线程” shutdown，shutdown 是异步操作
                for (int j = 0; j < i; j ++) {
                    children[j].shutdownGracefully();
                }

                // 等待这些线程成功 shutdown
                for (int j = 0; j < i; j ++) {
                    EventExecutor e = children[j];
                    try {
                        while (!e.isTerminated()) {
                            e.awaitTermination(Integer.MAX_VALUE, TimeUnit.SECONDS);
                        }
                    } catch (InterruptedException interrupted) {
                        // 把中断状态设置回去，交给关心的线程来处理.
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
    }
    // ================================================
    // === 到这里，就是代表上面的实例化所有线程已经成功结束 ===
    // ================================================

    // 通过之前设置的 chooserFactory 来实例化 Chooser，把线程池数组传进去，
    //     这就不必再说了吧，实现线程选择策略
    chooser = chooserFactory.newChooser(children);
    
    // 设置一个 Listener 用来监听该线程池的 termination 事件
    // 下面的代码逻辑是：给池中每一个线程都设置这个 listener，当监听到所有线程都 terminate 以后，这个线程池就算真正的 terminate 了。
    final FutureListener<Object> terminationListener = new FutureListener<Object>() {
        @Override
        public void operationComplete(Future<Object> future) throws Exception {
            if (terminatedChildren.incrementAndGet() == children.length) {
                terminationFuture.setSuccess(null);
            }
        }
    };
    for (EventExecutor e: children) {
        e.terminationFuture().addListener(terminationListener);
    }

    // 设置 readonlyChildren，它是只读集合，以后用到再说
    Set<EventExecutor> childrenSet = new LinkedHashSet<EventExecutor>(children.length);
    Collections.addAll(childrenSet, children);
    readonlyChildren = Collections.unmodifiableSet(childrenSet);
}
```

上面的代码非常简单吧，没有什么需要特别说的，接下来，我们来看看 newChild() 这个方法，这个方法非常重要，它将创建线程池中的线程。

> 我上面已经用过很多次"线程"这个词了，它可不是 Thread 的意思，而是指池中的个体，后面我们会看到每个"线程"在什么时候会真正创建 Thread 实例。反正每个 NioEventLoop 实例内部都会有一个自己的 Thread 实例，所以把这两个概念混在一起也无所谓吧。

`newChild(…)` 方法在 NioEventLoopGroup 中覆写了，上面说的"线程"其实就是 NioEventLoop：

```java
@Override
protected EventLoop newChild(Executor executor, Object... args) throws Exception {
    return new NioEventLoop(this, executor, (SelectorProvider) args[0],
        ((SelectStrategyFactory) args[1]).newSelectStrategy(), (RejectedExecutionHandler) args[2]);
}
```

它调用了 NioEventLoop 的构造方法：

```java
NioEventLoop(NioEventLoopGroup parent, Executor executor, SelectorProvider selectorProvider,
             SelectStrategy strategy, RejectedExecutionHandler rejectedExecutionHandler) {
    // 调用父类构造器
    super(parent, executor, false, DEFAULT_MAX_PENDING_TASKS, rejectedExecutionHandler);
    if (selectorProvider == null) {
        throw new NullPointerException("selectorProvider");
    }
    if (strategy == null) {
        throw new NullPointerException("selectStrategy");
    }
    provider = selectorProvider;
    // 开启 NIO 中最重要的组件：Selector
    final SelectorTuple selectorTuple = openSelector();
    selector = selectorTuple.selector;
    unwrappedSelector = selectorTuple.unwrappedSelector;
    selectStrategy = strategy;
}
```

我们先粗略观察一下，然后再往下看：

- 在 Netty 中，NioEventLoopGroup 代表线程池，NioEventLoop 就是其中的线程。
- 线程池 NioEventLoopGroup 是池中的线程 NioEventLoop 的 **parent**，从上面的代码中的取名可以看出。
- 每个 NioEventLoop 都有自己的 Selector，上面的代码也反应了这一点，这和 Tomcat 中的 NIO 模型有点区别。
- executor、selectStrategy 和 rejectedExecutionHandler 从 NioEventLoopGroup 中一路传到了 NioEventLoop 中。

这个时候，我们来看一下 NioEventLoop 类的属性都有哪些，我们先忽略它继承自父类的属性，单单看它自己的：

```java
private Selector selector;
private Selector unwrappedSelector;
private SelectedSelectionKeySet selectedKeys;

private final SelectorProvider provider;

private final AtomicBoolean wakenUp = new AtomicBoolean();

private final SelectStrategy selectStrategy;

private volatile int ioRatio = 50;
private int cancelledKeys;
private boolean needsToSelectAgain;

```

结合它的构造方法我们来总结一下：

- provider：它由 NioEventLoopGroup 传进来，前面我们说了一个线程池有一个 selectorProvider，用于创建 Selector 实例

- selector：虽然我们还没看创建 selector 的代码，但我们已经知道，在 Netty 中 Selector 是跟着线程池中的线程走的。也就是说，并非一个线程池一个 Selector 实例，而是线程池中每一个线程都有一个 Selector 实例。

  > 在无参构造过程中，我们发现，Netty 设置线程个数是 CPU 核心数的两倍，假设我们的机器 CPU 是 4 核，那么对应的就会有 8 个 Selector 实例。

- selectStrategy：select 操作的策略，这个不急。

- ioRatio：这是 IO 任务的执行时间比例，因为每个线程既有 IO 任务执行，也有非 IO 任务需要执行，所以该参数为了保证有足够时间是给 IO 的。这里也不需要急着去理解什么 IO 任务、什么非 IO 任务。

然后我们继续走它的构造方法，我们看到上面的构造方法调用了父类的构造器，它的父类是 SingleThreadEventLoop。

```java
protected SingleThreadEventLoop(EventLoopGroup parent, Executor executor,
                                boolean addTaskWakesUp, int maxPendingTasks,
                                RejectedExecutionHandler rejectedExecutionHandler) {
    super(parent, executor, addTaskWakesUp, maxPendingTasks, rejectedExecutionHandler);

    // 我们可以直接忽略这个东西，以后我们也不会再介绍它
    tailTasks = newTaskQueue(maxPendingTasks);
}
```

SingleThreadEventLoop 这个名字很诡异有没有？然后它的构造方法又调用了父类 SingleThreadEventExecutor 的构造方法：

```java
protected SingleThreadEventExecutor(EventExecutorGroup parent, Executor executor,
                                    boolean addTaskWakesUp, int maxPendingTasks,
                                    RejectedExecutionHandler rejectedHandler) {
    super(parent);
    this.addTaskWakesUp = addTaskWakesUp;
    this.maxPendingTasks = Math.max(16, maxPendingTasks);
    this.executor = ObjectUtil.checkNotNull(executor, "executor");
    // taskQueue，这个东西很重要，提交给 NioEventLoop 的任务都会进入到这个 taskQueue 中等待被执行
    // 这个 queue 的默认容量是 16
    taskQueue = newTaskQueue(this.maxPendingTasks);
    rejectedExecutionHandler = ObjectUtil.checkNotNull(rejectedHandler, "rejectedHandler");
}
```

到这里就更加诡异了，NioEventLoop 的父类是 SingleThreadEventLoop，而 SingleThreadEventLoop 的父类是 **SingleThreadEventExecutor**，它的名字告诉我们，它是一个 Executor，是一个线程池，而且是 Single Thread 单线程的。

也就是说，线程池 NioEventLoopGroup 中的每一个线程 NioEventLoop 也可以当做一个线程池来用，只不过它只有一个线程。这种设计虽然看上去很巧妙，不过有点反人类的样子。

上面这个构造函数比较简单：

- 设置了 parent，也就是之前创建的线程池 NioEventLoopGroup 实例

- executor：它是我们之前实例化的 ThreadPerTaskExecutor，我们说过，这个东西在线程池中没有用，它是给 NioEventLoop 用的，马上我们就要看到它了。提前透露一下，它用来开启 NioEventLoop 中的线程（Thread 实例）。

- taskQueue：这算是该构造方法中新的东西，它是任务队列。我们前面说过，NioEventLoop 需要负责 IO 事件和非 IO 事件，通常它都在执行 selector 的 select 方法或者正在处理 selectedKeys，如果我们要 submit 一个任务给它，任务就会被放到 taskQueue 中，等它来轮询。该队列是线程安全的 LinkedBlockingQueue，默认容量为 16。

- rejectedExecutionHandler：taskQueue 的默认容量是 16，所以，如果 submit 的任务堆积了到了 16，再往里面提交任务会触发 rejectedExecutionHandler 的执行策略。

  > 还记得默认策略吗：抛出RejectedExecutionException 异常。
  >
  > 在 NioEventLoopGroup 的默认构造中，它的实现是这样的：
  >
  > ```java
  >    private static final RejectedExecutionHandler REJECT = new RejectedExecutionHandler() {
  >        @Override
  >        public void rejected(Runnable task, SingleThreadEventExecutor executor) {
  >            throw new RejectedExecutionException();
  >        }
  >    };
  > ```

然后，我们再回到 NioEventLoop 的构造方法：

```java
NioEventLoop(NioEventLoopGroup parent, Executor executor, SelectorProvider selectorProvider,
             SelectStrategy strategy, RejectedExecutionHandler rejectedExecutionHandler) {
    // 我们刚刚说完了这个
    super(parent, executor, false, DEFAULT_MAX_PENDING_TASKS, rejectedExecutionHandler);
    if (selectorProvider == null) {
        throw new NullPointerException("selectorProvider");
    }
    if (strategy == null) {
        throw new NullPointerException("selectStrategy");
    }
    provider = selectorProvider;
    // 创建 selector 实例
    final SelectorTuple selectorTuple = openSelector();
    selector = selectorTuple.selector;
    unwrappedSelector = selectorTuple.unwrappedSelector;
    
    selectStrategy = strategy;
}
```

可以看到，最重要的方法其实就是 openSelector() 方法，它将创建 NIO 中最重要的一个组件 **Selector**。在这个方法中，Netty 也做了一些优化，这部分我们就不去分析它了。

到这里，我们的线程池 NioEventLoopGroup 创建完成了，并且实例化了池中的所有 NioEventLoop 实例。

同时，大家应该已经看到，上面并没有真正创建 NioEventLoop 中的线程（没有创建 Thread 实例）。

提前透露一下，创建线程的时机在第一个任务提交过来的时候，那么第一个任务是什么呢？是我们马上要说的 channel 的 **register** 操作。