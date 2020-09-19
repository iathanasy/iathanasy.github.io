---
name: netty-part-6
title: Netty 源码解析（六）- Channel 的 register 操作
date: 2020-09-19 12:50:06
tags: [Java,Netty]
categories: 
---
Netty 源码分析系列：

[Netty 源码解析（一）: 开始](/post/netty-part-1)

[Netty 源码解析（二）: Netty 的 Channel](/post/netty-part-2)

[Netty 源码解析（三）: Netty 的 Future 和 Promise](/post/netty-part-3)

[Netty 源码解析（四）: Netty 的 ChannelPipeline](/post/netty-part-4)

[Netty 源码解析（五）: Netty 的线程池分析](/post/netty-part-5)

当前 => Netty 源码解析（六）: Channel 的 register 操作

[Netty 源码解析（七）: NioEventLoop 工作流程](/post/netty-part-7)

[Netty 源码解析（八）: 回到 Channel 的 register 操作](/post/netty-part-8)

[Netty 源码解析（九）: connect 过程和 bind 过程分析](/post/netty-part-9)

## Channel 的 register 操作

经过前面的铺垫，我们已经具备一定的基础了，我们开始来把前面学到的内容揉在一起。这节，我们会介绍 register 操作，这一步其实是非常关键的，对于我们源码分析非常重要。

我们从 EchoClient 中的 connect() 方法出发，或者 EchoServer 的 bind(port) 方法出发，都会走到 initAndRegister() 这个方法：

```java
final ChannelFuture initAndRegister() {
    Channel channel = null;
    try {
        // 1
        channel = channelFactory.newChannel();
        // 2 对于 Bootstrap 和 ServerBootstrap，这里面有些不一样
        init(channel);
    } catch (Throwable t) {
        ...
    }
	// 3 我们这里要说的是这行
    ChannelFuture regFuture = config().group().register(channel);
    if (regFuture.cause() != null) {
        if (channel.isRegistered()) {
            channel.close();
        } else {
            channel.unsafe().closeForcibly();
        }
    }
    return regFuture;
}
```

initAndRegister() 这个方法我们已经接触过两次了，前面介绍了 1️⃣ Channel 的实例化，实例化过程中，会执行 Channel 内部 Unsafe 和 Pipeline 的实例化，以及在上面 2️⃣ init(channel) 方法中，会往 pipeline 中添加 handler（pipeline 此时是 head+channelnitializer+tail）。

> 我们这节终于要揭秘 ChannelInitializer 中的 initChannel 方法了~~~

现在，我们继续往下走，看看 3️⃣ **register** 这一步：

```java
ChannelFuture regFuture = config().group().register(channel);
```

> 我们说了，register 这一步是非常关键的，它发生在 channel 实例化以后，大家回忆一下当前 channel 中的一些情况：
>
> 实例化了 JDK 底层的 Channel，设置了非阻塞，实例化了 Unsafe，实例化了 Pipeline，同时往 pipeline 中添加了 head、tail 以及一个 ChannelInitializer 实例。

上面的 `config().group()` 方法会返回前面实例化的 NioEventLoopGroup 的实例，然后调用其 register(channel) 方法：

// MultithreadEventLoopGroup

```java
@Override
public ChannelFuture register(Channel channel) {
    return next().register(channel);
}
```

next() 方法很简单，就是选择线程池中的一个线程（还记得 chooserFactory 吗），也就是选择一个 NioEventLoop 实例，这个时候我们就进入到 NioEventLoop 了。

NioEventLoop 的 register(channel) 方法实现在它的父类 **SingleThreadEventLoop** 中：

```java
@Override
public ChannelFuture register(Channel channel) {
    return register(new DefaultChannelPromise(channel, this));
}
```

上面的代码实例化了一个 Promise，将当前 channel 带了进去：

```java
@Override
public ChannelFuture register(final ChannelPromise promise) {
    ObjectUtil.checkNotNull(promise, "promise");
    // promise 关联了 channel，channel 持有 Unsafe 实例，register 操作就封装在 Unsafe 中
    promise.channel().unsafe().register(this, promise);
    return promise;
}
```

拿到 channel 中关联的 Unsafe 实例，然后调用它的 register 方法：

> 我们说过，Unsafe 专门用来封装底层实现，当然这里也没那么“底层”

// AbstractChannel#**AbstractUnsafe**

```java
@Override
public final void register(EventLoop eventLoop, final ChannelPromise promise) {
    ...
    // 将这个 eventLoop 实例设置给这个 channel，从此这个 channel 就是有 eventLoop 的了
    // 我觉得这一步其实挺关键的，因为后续该 channel 中的所有异步操作，都要提交给这个 eventLoop 来执行
    AbstractChannel.this.eventLoop = eventLoop;

    // 如果发起 register 动作的线程就是 eventLoop 实例中的线程，那么直接调用 register0(promise)
    // 对于我们来说，它不会进入到这个分支，
    //     之所以有这个分支，是因为我们是可以 unregister，然后再 register 的，后面再仔细看
    if (eventLoop.inEventLoop()) {
        register0(promise);
    } else {
        try {
            // 否则，提交任务给 eventLoop，eventLoop 中的线程会负责调用 register0(promise)
            eventLoop.execute(new Runnable() {
                @Override
                public void run() {
                    register0(promise);
                }
            });
        } catch (Throwable t) {
            ...
        }
    }
}
```

> 到这里，我们要明白，NioEventLoop 中是还没有实例化 Thread 实例的。

这几步涉及到了好几个类：NioEventLoop、Promise、Channel、Unsafe 等，大家要仔细理清楚它们的关系。

对于我们前面过来的 register 操作，其实提交到 eventLoop 以后，就直接返回 promise 实例了，剩下的register0 是异步操作，它由 NioEventLoop 实例来完成。

我们这边先不继续往里分析 register0(promise) 方法，先把前面欠下的 NioEventLoop 中的线程介绍清楚，然后再回来介绍这个 register0 方法。

> Channel 实例一旦 register 到了 NioEventLoopGroup 实例中的某个 NioEventLoop 实例，那么后续该 Channel 的所有操作，都是由该 NioEventLoop 实例来完成的。
>
> 这个也非常简单，因为 Selector 实例是在 NioEventLoop 实例中的，Channel 实例一旦注册到某个 Selector 实例中，当然也只能在这个实例中处理 NIO 事件。