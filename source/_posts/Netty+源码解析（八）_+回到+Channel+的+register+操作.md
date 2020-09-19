---
name: netty-part-8
title: Netty 源码解析（八）- 回到 Channel 的 register 操作
date: 2020-09-19 12:50:12
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

[Netty 源码解析（七）: NioEventLoop 工作流程](/post/netty-part-7)

当前 => Netty 源码解析（八）: 回到 Channel 的 register 操作

[Netty 源码解析（九）: connect 过程和 bind 过程分析](/post/netty-part-9)

## 回到 Channel 的 register 操作

我们回到前面的 register0(promise) 方法，我们知道，这个 register 任务进入到了 NioEventLoop 的 taskQueue 中，然后会启动 NioEventLoop 中的线程，该线程会轮询这个 taskQueue，然后执行这个 register 任务。

注意，此时执行该方法的是 eventLoop 中的线程：

// AbstractChannel

```java
private void register0(ChannelPromise promise) {
    try {
		...
        boolean firstRegistration = neverRegistered;
        // *** 进行 JDK 底层的操作：Channel 注册到 Selector 上 ***
        doRegister();
        
        neverRegistered = false;
        registered = true;
        // 到这里，就算是 registered 了
        
        // 这一步也很关键，因为这涉及到了 ChannelInitializer 的 init(channel)
        // 我们之前说过，init 方法会将 ChannelInitializer 内部添加的 handlers 添加到 pipeline 中
        pipeline.invokeHandlerAddedIfNeeded();

        // 设置当前 promise 的状态为 success
        //   因为当前 register 方法是在 eventLoop 中的线程中执行的，需要通知提交 register 操作的线程
        safeSetSuccess(promise);
        
        // 当前的 register 操作已经成功，该事件应该被 pipeline 上
        //   所有关心 register 事件的 handler 感知到，往 pipeline 中扔一个事件
        pipeline.fireChannelRegistered();

        // 这里 active 指的是 channel 已经打开
        if (isActive()) {
            // 如果该 channel 是第一次执行 register，那么 fire ChannelActive 事件
            if (firstRegistration) {
                pipeline.fireChannelActive();
            } else if (config().isAutoRead()) {
                // 该 channel 之前已经 register 过了，
                // 这里让该 channel 立马去监听通道中的 OP_READ 事件
                beginRead();
            }
        }
    } catch (Throwable t) {
        ...
    }
}
```

我们先说掉上面的 doRegister() 方法，然后再说 pipeline。

```java
@Override
protected void doRegister() throws Exception {
    boolean selected = false;
    for (;;) {
        try {
            // 附 JDK 中 Channel 的 register 方法：
            // public final SelectionKey register(Selector sel, int ops, Object att) {...}
            selectionKey = javaChannel().register(eventLoop().unwrappedSelector(), 0, this);
            return;
        } catch (CancelledKeyException e) {
            ...
        }
    }
}
```

我们可以看到，这里做了 JDK 底层的 register 操作，将 SocketChannel(或 ServerSocketChannel) 注册到 Selector 中，并且可以看到，这里的监听集合设置为了 **0**，也就是什么都不监听。

> 当然，也就意味着，后续一定有某个地方会需要修改这个 selectionKey 的监听集合，不然啥都干不了

我们重点来说说 **pipeline** 操作，我们之前在介绍 NioSocketChannel 的 pipeline 的时候介绍到，我们的 pipeline 现在长这个样子：

![20](https://www.javadoop.com/blogimages/netty-source/20.png)

> 现在，我们将看到这里会把 LoggingHandler 和 EchoClientHandler 添加到 pipeline。

我们继续看代码，register 成功以后，执行了以下操作：

```java
pipeline.invokeHandlerAddedIfNeeded();
```

大家可以跟踪一下，这一步会执行到 pipeline 中 ChannelInitializer 实例的 handlerAdded 方法，在这里会执行它的 init(context) 方法：

```java
@Override
public void handlerAdded(ChannelHandlerContext ctx) throws Exception {
    if (ctx.channel().isRegistered()) {
        initChannel(ctx);
    }
}
```

然后我们看下 initChannel(ctx)，这里终于来了我们之前介绍过的 init(channel) 方法：

```java
private boolean initChannel(ChannelHandlerContext ctx) throws Exception {
    if (initMap.putIfAbsent(ctx, Boolean.TRUE) == null) { // Guard against re-entrance.
        try {
            // 1. 将把我们自定义的 handlers 添加到 pipeline 中
            initChannel((C) ctx.channel());
        } catch (Throwable cause) {
            ...
        } finally {
            // 2. 将 ChannelInitializer 实例从 pipeline 中删除
            remove(ctx);
        }
        return true;
    }
    return false;
}
```

我们前面也说过，ChannelInitializer 的 init(channel) 被执行以后，那么其内部添加的 handlers 会进入到 pipeline 中，然后上面的 finally 块中将 ChannelInitializer 的实例从 pipeline 中删除，那么此时 pipeline 就算建立起来了，如下图：

![21](https://www.javadoop.com/blogimages/netty-source/21.png)

> 其实这里还有个问题，如果我们在 ChannelInitializer 中添加的是一个 ChannelInitializer 实例呢？大家可以考虑下这个情况。

pipeline 建立了以后，然后我们继续往下走，会执行到这一句：

```java
pipeline.fireChannelRegistered();
```

我们只要摸清楚了 fireChannelRegistered() 方法，以后碰到其他像 fireChannelActive()、fireXxx() 等就知道怎么回事了，它们都是类似的。我们来看看这句代码会发生什么：

// DefaultChannelPipeline

```java
@Override
public final ChannelPipeline fireChannelRegistered() {
    // 注意这里的传参是 head
    AbstractChannelHandlerContext.invokeChannelRegistered(head);
    return this;
}
```

也就是说，我们往 pipeline 中扔了一个 **channelRegistered** 事件，这里的 register 属于 Inbound 事件，pipeline 接下来要做的就是执行 pipeline 中的 Inbound 类型的 handlers 中的 channelRegistered() 方法。

从上面的代码，我们可以看出，往 pipeline 中扔出 channelRegistered 事件以后，第一个处理的 handler 是 **head**。

接下来，我们还是跟着代码走，此时我们来到了 pipeline 的第一个节点 **head** 的处理中：

// AbstractChannelHandlerContext

```java
// next 此时是 head
static void invokeChannelRegistered(final AbstractChannelHandlerContext next) {

    EventExecutor executor = next.executor();
    // 执行 head 的 invokeChannelRegistered()
    if (executor.inEventLoop()) {
        next.invokeChannelRegistered();
    } else {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                next.invokeChannelRegistered();
            }
        });
    }
}
```

也就是说，这里会先执行 head.invokeChannelRegistered() 方法，而且是放到 NioEventLoop 中的 taskQueue 中执行的：

// AbstractChannelHandlerContext

```java
private void invokeChannelRegistered() {
    if (invokeHandler()) {
        try {
            // handler() 方法此时会返回 head
            ((ChannelInboundHandler) handler()).channelRegistered(this);
        } catch (Throwable t) {
            notifyHandlerException(t);
        }
    } else {
        fireChannelRegistered();
    }
}
```

我们去看 head 的 channelRegistered 方法：

// HeadContext

```java
@Override
public void channelRegistered(ChannelHandlerContext ctx) throws Exception {
    // 1. 这一步是 head 对于 channelRegistered 事件的处理。没有我们要关心的
    invokeHandlerAddedIfNeeded();
    // 2. 向后传播 Inbound 事件
    ctx.fireChannelRegistered();
}
```

然后 head 会执行 fireChannelRegister() 方法：

// AbstractChannelHandlerContext

```java
@Override
public ChannelHandlerContext fireChannelRegistered() {
    // 这里很关键
    // findContextInbound() 方法会沿着 pipeline 找到下一个 Inbound 类型的 handler
    invokeChannelRegistered(findContextInbound());
    return this;
}
```

> 注意：pipeline.fireChannelRegistered() 是将 channelRegistered 事件抛到 pipeline 中，pipeline 中的 handlers 准备处理该事件。而 context.fireChannelRegistered() 是一个 handler 处理完了以后，向后传播给下一个 handler。
>
> 它们两个的方法名字是一样的，但是来自于不同的类。

findContextInbound() 将找到下一个 Inbound 类型的 handler，然后又是重复上面的几个方法。

> 我觉得上面这块代码没必要太纠结，总之就是从 head 中开始，依次往下寻找所有 Inbound handler，执行其 channelRegistered(ctx) 操作。

说了这么多，我们的 register 操作算是真正完成了。

下面，我们回到 initAndRegister 这个方法：

```java
final ChannelFuture initAndRegister() {
    Channel channel = null;
    try {
        channel = channelFactory.newChannel();
        init(channel);
    } catch (Throwable t) {
        ...
    }

    // 我们上面说完了这行
    ChannelFuture regFuture = config().group().register(channel);
    
    // 如果在 register 的过程中，发生了错误
    if (regFuture.cause() != null) {
        if (channel.isRegistered()) {
            channel.close();
        } else {
            channel.unsafe().closeForcibly();
        }
    }

    // 源码中说得很清楚，如果到这里，说明后续可以进行 connect() 或 bind() 了，因为两种情况：
    // 1. 如果 register 动作是在 eventLoop 中发起的，那么到这里的时候，register 一定已经完成
    // 2. 如果 register 任务已经提交到 eventLoop 中，也就是进到了 eventLoop 中的 taskQueue 中，
    //    由于后续的 connect 或 bind 也会进入到同一个 eventLoop 的 queue 中，所以一定是会先 register 成功，才会执行 connect 或 bind
    return regFuture;
}
```

我们要知道，不管是服务端的 NioServerSocketChannel 还是客户端的 NioSocketChannel，在 bind 或 connect 时，都会先进入 initAndRegister 这个方法，所以我们上面说的那些，对于两者都是通用的。

大家要记住，register 操作是非常重要的，要知道这一步大概做了哪些事情，register 操作以后，将进入到 bind 或 connect 操作中。