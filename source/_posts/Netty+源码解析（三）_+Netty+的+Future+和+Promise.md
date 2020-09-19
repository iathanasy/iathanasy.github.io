---
name: netty-part-3
title: Netty 源码解析（三）- Netty 的 Future 和 Promise
date: 2020-09-19 12:49:58
tags: [Java,Netty]
categories: 
---
Netty 源码分析系列：

[Netty 源码解析（一）: 开始](/post/netty-part-1)

[Netty 源码解析（二）: Netty 的 Channel](/post/netty-part-2)

当前 => Netty 源码解析（三）: Netty 的 Future 和 Promise

[Netty 源码解析（四）: Netty 的 ChannelPipeline](/post/netty-part-4)

[Netty 源码解析（五）: Netty 的线程池分析](/post/netty-part-5)

[Netty 源码解析（六）: Channel 的 register 操作](/post/netty-part-6)

[Netty 源码解析（七）: NioEventLoop 工作流程](/post/netty-part-7)

[Netty 源码解析（八）: 回到 Channel 的 register 操作](/post/netty-part-8)

[Netty 源码解析（九）: connect 过程和 bind 过程分析](/post/netty-part-9)



## Netty 中的异步编程: Future 和 Promise

Netty 中非常多的异步调用，所以在介绍更多 NIO 相关的内容之前，我们来看看它的异步接口是怎么使用的。

前面我们在介绍 Echo 例子的时候，已经用过了 ChannelFuture 这个接口了：

![6](https://www.javadoop.com/blogimages/netty-source/6.png)

争取在看完本节后，读者能搞清楚上面的这几行划线部分是怎么走的。

关于 Future 接口，我想大家应该都很熟悉，用得最多的就是在使用 Java 的线程池 ThreadPoolExecutor 的时候了。在 **submit** 一个任务到线程池中的时候，返回的就是一个 **Future** 实例，通过它来获取提交的任务的执行状态和最终的执行结果，我们最常用它的 `isDone()` 和 `get()` 方法。

下面是 JDK  中的 Future 接口 java.util.concurrent.Future：

```java
public interface Future<V> {
	// 取消该任务
    boolean cancel(boolean mayInterruptIfRunning);
    // 任务是否已取消
    boolean isCancelled();
	// 任务是否已完成
    boolean isDone();
    // 阻塞获取任务执行结果
    V get() throws InterruptedException, ExecutionException;
    // 带超时参数的获取任务执行结果
    V get(long timeout, TimeUnit unit)
        throws InterruptedException, ExecutionException, TimeoutException;
}
```

Netty 中的 Future 接口（同名）继承了 JDK 中的 Future 接口，然后添加了一些方法：

// io.netty.util.concurrent.Future

```java
public interface Future<V> extends java.util.concurrent.Future<V> {

    // 是否成功
    boolean isSuccess();
    
	// 是否可取消
    boolean isCancellable();

    // 如果任务执行失败，这个方法返回异常信息
    Throwable cause();

    // 添加 Listener 来进行回调
    Future<V> addListener(GenericFutureListener<? extends Future<? super V>> listener);
    Future<V> addListeners(GenericFutureListener<? extends Future<? super V>>... listeners);

    Future<V> removeListener(GenericFutureListener<? extends Future<? super V>> listener);
    Future<V> removeListeners(GenericFutureListener<? extends Future<? super V>>... listeners);

    // 阻塞等待任务结束，如果任务失败，将“导致失败的异常”重新抛出来
    Future<V> sync() throws InterruptedException;
    // 不响应中断的 sync()，这个大家应该都很熟了
    Future<V> syncUninterruptibly();

    // 阻塞等待任务结束，和 sync() 功能是一样的，不过如果任务失败，它不会抛出执行过程中的异常
    Future<V> await() throws InterruptedException;
    Future<V> awaitUninterruptibly();
    boolean await(long timeout, TimeUnit unit) throws InterruptedException;
    boolean await(long timeoutMillis) throws InterruptedException;
    boolean awaitUninterruptibly(long timeout, TimeUnit unit);
    boolean awaitUninterruptibly(long timeoutMillis);

    // 获取执行结果，不阻塞。我们都知道 java.util.concurrent.Future 中的 get() 是阻塞的
    V getNow();

    // 取消任务执行，如果取消成功，任务会因为 CancellationException 异常而导致失败
    //	  也就是 isSuccess()==false，同时上面的 cause() 方法返回 CancellationException 的实例。
    // mayInterruptIfRunning 说的是：是否对正在执行该任务的线程进行中断(这样才能停止该任务的执行)，
    // 	  似乎 Netty 中 Future 接口的各个实现类，都没有使用这个参数
    @Override
    boolean cancel(boolean mayInterruptIfRunning);
}
```

看完上面的 Netty 的 Future 接口，我们可以发现，它加了 sync() 和 await() 用于阻塞等待，还加了 Listeners，只要任务结束去回调 Listener 们就可以了，那么我们就不一定要主动调用 isDone() 来获取状态，或通过 get() 阻塞方法来获取值。

> 所以它其实有两种使用范式

顺便说下 sync() 和 await() 的区别：sync() 内部会先调用 await() 方法，等 await() 方法返回后，会检查下**这个任务是否失败**，如果失败，重新将导致失败的异常抛出来。也就是说，如果使用 await()，任务抛出异常后，await() 方法会返回，但是不会抛出异常，而 sync() 方法返回的同时会抛出异常。

> 我们也可以看到，Future 接口没有和 IO 操作关联在一起，还是比较*纯净*的接口。

接下来，我们来看 Future 接口的子接口 ChannelFuture，这个接口用得最多，它将和 IO 操作中的 Channel 关联在一起了，用于异步处理 Channel 中的事件。

```java
public interface ChannelFuture extends Future<Void> {

    // ChannelFuture 关联的 Channel
    Channel channel();

    // 覆写以下几个方法，使得它们返回值为 ChannelFuture 类型 
    @Override
    ChannelFuture addListener(GenericFutureListener<? extends Future<? super Void>> listener);
    @Override
    ChannelFuture addListeners(GenericFutureListener<? extends Future<? super Void>>... listeners);
    @Override
    ChannelFuture removeListener(GenericFutureListener<? extends Future<? super Void>> listener);
    @Override
    ChannelFuture removeListeners(GenericFutureListener<? extends Future<? super Void>>... listeners);

    @Override
    ChannelFuture sync() throws InterruptedException;
    @Override
    ChannelFuture syncUninterruptibly();
    
    @Override
    ChannelFuture await() throws InterruptedException;
    @Override
    ChannelFuture awaitUninterruptibly();

    // 用来标记该 future 是 void 的，
    // 这样就不允许使用 addListener(...), sync(), await() 以及它们的几个重载方法
    boolean isVoid();
}
```

我们看到，ChannelFuture 接口相对于 Future 接口，除了将 channel 关联进来，没有增加什么东西。还有个 isVoid() 方法算是不那么重要的存在吧。其他几个都是方法覆写，为了让返回值类型变为 ChannelFuture，而不是原来的 Future。

这里有点跳，我们来介绍下 Promise 接口，它和 ChannelFuture 接口无关，而是和前面的 Future 接口相关，Promise 这个接口非常重要。

Promise 接口和 ChannelFuture 一样，也继承了 Netty 的 Future 接口，然后加了一些 Promise 的内容：

```java
public interface Promise<V> extends Future<V> {

    // 标记该 future 成功及设置其执行结果，并且会通知所有的 listeners。
    // 如果该操作失败，将抛出异常(失败指的是该 future 已经有了结果了，成功的结果，或者失败的结果)
    Promise<V> setSuccess(V result);

    // 和 setSuccess 方法一样，只不过如果失败，它不抛异常，返回 false
    boolean trySuccess(V result);

    // 标记该 future 失败，及其失败原因。
    // 如果失败，将抛出异常(失败指的是已经有了结果了)
    Promise<V> setFailure(Throwable cause);
	
    // 标记该 future 失败，及其失败原因。
    // 如果已经有结果，返回 false，不抛出异常
    boolean tryFailure(Throwable cause);

    // 标记该 future 不可以被取消
    boolean setUncancellable();

    // 这里和 ChannelFuture 一样，对这几个方法进行覆写，目的是为了返回 Promise 类型的实例
    @Override
    Promise<V> addListener(GenericFutureListener<? extends Future<? super V>> listener);
    @Override
    Promise<V> addListeners(GenericFutureListener<? extends Future<? super V>>... listeners);

    @Override
    Promise<V> removeListener(GenericFutureListener<? extends Future<? super V>> listener);
    @Override
    Promise<V> removeListeners(GenericFutureListener<? extends Future<? super V>>... listeners);

    @Override
    Promise<V> await() throws InterruptedException;
    @Override
    Promise<V> awaitUninterruptibly();

    @Override
    Promise<V> sync() throws InterruptedException;
    @Override
    Promise<V> syncUninterruptibly();
}
```

可能有些读者对 Promise 的概念不是很熟悉，这里简单说两句。

我觉得只要明白一点，Promise 实例内部是一个任务，任务的执行往往是异步的，通常是一个线程池来处理任务。Promise 提供的 setSuccess(V result) 或 setFailure(Throwable t) 将来会被某个执行任务的线程在执行完成以后调用，同时那个线程在调用 setSuccess(result) 或 setFailure(t) 后会回调 listeners 的回调函数（当然，回调的具体内容不一定要由执行任务的线程自己来执行，它可以创建新的线程来执行，也可以将回调任务提交到某个线程池来执行）。而且，一旦 setSuccess(...) 或 setFailure(...) 后，那些 await() 或 sync() 的线程就会从等待中返回。

**所以这里就有两种编程方式，一种是用 await()，等 await() 方法返回后，得到 promise 的执行结果，然后处理它；另一种就是提供 Listener 实例，我们不太关心任务什么时候会执行完，只要它执行完了以后会去执行 listener 中的处理方法就行。**

接下来，我们再来看下 **ChannelPromise**，它继承了前面介绍的 ChannelFuture 和 Promise 接口。

![4](https://www.javadoop.com/blogimages/netty-source/4.png)

ChannelPromise 接口在 Netty 中使用得比较多，因为它综合了 ChannelFuture 和 Promise 两个接口：

```java
/**
 * Special {@link ChannelFuture} which is writable.
 */
public interface ChannelPromise extends ChannelFuture, Promise<Void> {

    // 覆写 ChannelFuture 中的 channel() 方法，其实这个方法一点没变
    @Override
    Channel channel();

    // 下面几个方法是覆写 Promise 中的接口，为了返回值类型是 ChannelPromise
    @Override
    ChannelPromise setSuccess(Void result);
    ChannelPromise setSuccess();
    boolean trySuccess();
    @Override
    ChannelPromise setFailure(Throwable cause);

    // 到这里大家应该都熟悉了，下面几个方法的覆写也是为了得到 ChannelPromise 类型的实例
    @Override
    ChannelPromise addListener(GenericFutureListener<? extends Future<? super Void>> listener);
    @Override
    ChannelPromise addListeners(GenericFutureListener<? extends Future<? super Void>>... listeners);
    @Override
    ChannelPromise removeListener(GenericFutureListener<? extends Future<? super Void>> listener);
    @Override
    ChannelPromise removeListeners(GenericFutureListener<? extends Future<? super Void>>... listeners);

    @Override
    ChannelPromise sync() throws InterruptedException;
    @Override
    ChannelPromise syncUninterruptibly();
    @Override
    ChannelPromise await() throws InterruptedException;
    @Override
    ChannelPromise awaitUninterruptibly();

    /**
     * Returns a new {@link ChannelPromise} if {@link #isVoid()} returns {@code true} otherwise itself.
     */
    // 我们忽略这个方法吧。
    ChannelPromise unvoid();
}
```

我们可以看到，它综合了 ChannelFuture 和 Promise 中的方法，只不过通过覆写将返回值都变为 ChannelPromise 了而已，**没有增加什么新的功能**。

小结一下，我们上面介绍了几个接口，Future 以及它的子接口 ChannelFuture 和 Promise，然后是 ChannelPromise 接口同时继承了 ChannelFuture 和 Promise。

我把这几个接口的主要方法列在一起，这样大家看得清晰些：

![4](https://www.javadoop.com/blogimages/netty-source/7.png)

接下来，我们需要来一个实现类，这样才能比较直观地看出它们是怎么使用的，因为上面的这些都是接口定义，具体还得看实现类是怎么工作的。

下面，我们来介绍下 **DefaultPromise** 这个实现类，这个类很常用，它的源码也不短，我们先介绍几个关键的内容，然后介绍一个示例使用。

首先，我们看下它有哪些属性：

```java
public class DefaultPromise<V> extends AbstractFuture<V> implements Promise<V> {
	  // 保存执行结果
    private volatile Object result;
    // 执行任务的线程池，promise 持有 executor 的引用，这个其实有点奇怪了
    // 因为“任务”其实没必要知道自己在哪里被执行的
    private final EventExecutor executor;
	  // 监听者，回调函数，任务结束后（正常或异常结束）执行
    private Object listeners;

    // 等待这个 promise 的线程数(调用sync()/await()进行等待的线程数量)
    private short waiters;

    // 是否正在唤醒等待线程，用于防止重复执行唤醒，不然会重复执行 listeners 的回调方法
    private boolean notifyingListeners;
    ......
}
```

> 可以看出，此类实现了 Promise，但是没有实现 ChannelFuture，所以它和 Channel 联系不起来。
>
> 别急，我们后面会碰到另一个类 DefaultChannelPromise 的使用，这个类是综合了 ChannelFuture 和 Promise 的，但是它的实现其实大部分都是继承自这里的 DefaultPromise 类的。

说完上面的属性以后，大家可以看下 `setSuccess(V result)` 、`trySuccess(V result)` 和 `setFailure(Throwable cause)` 、 `tryFailure(Throwable cause)` 这几个方法：

![8](https://www.javadoop.com/blogimages/netty-source/8.png)

> 看出 setSuccess(result) 和 trySuccess(result) 的区别了吗？

上面几个方法都非常简单，先设置好值，然后执行监听者们的回调方法。notifyListeners() 方法感兴趣的读者也可以看一看，不过它还涉及到 Netty 线程池的一些内容，我们还没有介绍到线程池，这里就不展开了。上面的代码，在 setSuccess0 或 setFailure0 方法中都会唤醒阻塞在 sync() 或 await() 的线程

另外，就是可以看下 sync() 和 await() 的区别，其他的我觉得随便看看就好了。

```java
@Override
public Promise<V> sync() throws InterruptedException {
    await();
    // 如果任务是失败的，重新抛出相应的异常
    rethrowIfFailed();
    return this;
}
```

接下来，我们来写个实例代码吧：

```java
    public static void main(String[] args) {

        // 构造线程池
        EventExecutor executor = new DefaultEventExecutor();

        // 创建 DefaultPromise 实例
        Promise promise = new DefaultPromise(executor);

        // 下面给这个 promise 添加两个 listener
        promise.addListener(new GenericFutureListener<Future<Integer>>() {
            @Override
            public void operationComplete(Future future) throws Exception {
                if (future.isSuccess()) {
                    System.out.println("任务结束，结果：" + future.get());
                } else {
                    System.out.println("任务失败，异常：" + future.cause());
                }
            }
        }).addListener(new GenericFutureListener<Future<Integer>>() {
            @Override
            public void operationComplete(Future future) throws Exception {
                System.out.println("任务结束，balabala...");
            }
        });

        // 提交任务到线程池，五秒后执行结束，设置执行 promise 的结果
        executor.submit(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(5000);
                } catch (InterruptedException e) {
                }
                // 设置 promise 的结果
                // promise.setFailure(new RuntimeException());
                promise.setSuccess(123456);
            }
        });

        // main 线程阻塞等待执行结果
        try {
            promise.sync();
        } catch (InterruptedException e) {
        }
    }
```

运行代码，两个 listener 将在 5 秒后将输出：

```
任务结束，结果：123456
任务结束，balabala...
```

> 读者这里可以试一下 sync() 和 await() 的区别，在任务中调用 promise.setFailure(new RuntimeException()) 试试看。

上面的代码中，大家可能会对线程池 executor 和 promise 之间的关系感到有点迷惑。读者应该也要清楚，具体的任务不一定就要在这个 executor 中被执行。任务结束以后，需要调用 promise.setSuccess(result) 作为通知。

通常来说，promise 代表的 future 是不需要和线程池搅在一起的，future 只关心任务是否结束以及任务的执行结果，至于是哪个线程或哪个线程池执行的任务，future 其实是不关心的。

不过 Netty 毕竟不是要创建一个通用的线程池实现，而是和它要处理的 IO 息息相关的，所以我们只不过要理解它就好了。

这节就说这么多吧，我们回过头来再看一下这张图，看看大家是不是看懂了这节内容：

![6](https://www.javadoop.com/blogimages/netty-source/6.png)

我们就说说上图左边的部分吧，虽然我们还不知道 bind() 操作中具体会做什么工作，但是我们应该可以猜出一二。

显然，main 线程调用 b.bind(port) 这个方法会返回一个 ChannelFuture，bind() 是一个异步方法，当某个执行线程执行了真正的绑定操作后，那个执行线程一定会标记这个 future 为成功（我们假定 bind 会成功），然后这里的 sync() 方法（main 线程）就会返回了。

> 如果 bind(port) 失败，我们知道，sync() 方法会将异常抛出来，然后就会执行到 finally 块了。 

一旦绑定端口 bind 成功，进入下面一行，f.channel() 方法会返回该 future 关联的 channel。

channel.closeFuture() 也会返回一个 ChannelFuture，然后调用了 sync() 方法，这个 sync() 方法返回的条件是：**有其他的线程关闭了 NioServerSocketChannel**，往往是因为需要停掉服务了，然后那个线程会设置 future 的状态（ setSuccess(result) 或 setFailure(cause) ），这个 sync() 方法才会返回。

这节就到这里，希望大家对 Netty 中的异步编程有些了解，后续碰到源码的时候能知道是怎么使用的了。