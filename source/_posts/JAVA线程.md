---
title: JAVA线程
date: 2020-03-07 12:24:08
tags: [Java,Java线程]
---

<!-- more -->

### 线程
 > java.lang.Thread.State 6种状态  
 
 1. NEW：尚未启动的线程状态
 2. RUNNABLE：可运行的线程状态等待CPU调用
 3. BLOCKED：线程阻塞等待监视器锁定的线程状态。处于synchronized同步代码块或方法中被阻塞。
 4. WAITING：等待线程的状态。不带超时的方式：Object.wait、Thread.join、LockSupport.park。
 5. TIMED_WAITING：具有指定等待时间的等待线程的线程状态。不带超时的方式：：Thread.sleep、Object.wait、Thread.join、LockSupport.parkNanos、LockSupport.parkUntil。
 6. TERMINATED：终止线程的线程状态。线程正常完成执行或出现异常。
 
 >  线程方法  
 
 - thread.start();//启动
 - thread.interrupt(); //停止
 - Thread.interrupted();//中断
 - thread.isAlive();//是否存活
 
> volatile与synchronized

- volatile: 变量可见性(class ->  运行时jit编译  -> 汇编指令 -> 重排序),主线程操作改变量会被其他线程读取最新值,<font style='color:red'>不会缓存，不用被重排序。</font>
- synchronized: 同步
 
 > 等待  
 
- Thread.currentThread().suspend/resume();对调用顺序有要求，也要开发自己注意锁的释放。这个被<font style='color:red'>弃用的API</font>， 容易死锁，也容易导致永久挂起。
- wait/notify: 要求再同步关键字里面使用，免去了死锁的困扰，但是一定要先调用wait，再调用notify，否则永久等待了
- LockSupport.park/unpark(); 没有顺序要求，但是park并不会释放锁，所有再同步代码中使用要注意


### 线程池  
> ThreadPoolExecutor  

`参数：核心线程数、最大线程数、超出核心线程存活时间、时间类型、队列、拒绝策略`

执行15个线程
- 5, 10, 5, TimeUnit.SECONDS,new LinkedBlockingQueue<Runnable>(): `// 预计结果：线程池线程数量为：5,超出数量的任务，其他的进入队列中等待被执行`
- 5, 10, 5, TimeUnit.SECONDS,new LinkedBlockingQueue<Runnable>(3), new RejectedExecutionHandler():`//5个任务直接分配线程开始执行、3个任务进入等待队列、 队列不够用，临时加开5个线程来执行任务(5秒没活干就销毁)、 队列和线程池都满了，剩下2个任务，没资源了，被拒绝执行。、 任务执行，5秒后，如果无任务可执行，销毁临时创建的5个线程`
- 5, 5, 0L, TimeUnit.MILLISECONDS,new LinkedBlockingQueue<Runnable>()：<font style="color:red;">同Executors.newFixedThreadPool(int nThreads)</font>`//线程池线程数量为：5，超出数量的任务，其他的进入队列中等待被执行`
- 0, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS,new SynchronousQueue<Runnable>()：<font style="color:red;">同Executors.newCachedThreadPool()</font>，SynchronousQueue，实际上它不是一个真正的队列，因为它不会为队列中元素维护存储空间。与其他队列不同的是，它维护一组线程，这些线程在等待着把元素加入或移出队列。
`//线程池线程数量为：15，超出数量的任务，其他的进入队列中等待被执行 、 所有任务执行结束，60秒后，如果无任务可执行，所有线程全部被销毁，池的大小恢复为0`
  
定时执行线程池
- ScheduledThreadPoolExecutor(5):<font style="color:red;">同Executors.newScheduledThreadPool()</font>`executor.schedule(runnable(),3000, TimeUnit.MILLISECONDS); //任务在3秒后被执行一次`
- <font style="color:red;">executor.scheduleAtFixedRate(runnable(),2000, 1000, TimeUnit.MILLISECONDS);</font>: ` 提交后，2秒后开始第一次执行，之后每间隔1秒，固定执行一次(如果发现上次执行还未完毕，则等待完毕，完毕后立刻执行)。`
- <font style="color:red;">executor.scheduleWithFixedDelay(runnable(),2000, 1000, TimeUnit.MILLISECONDS);</font>: ` 提交后，2秒后开始第一次执行，之后每间隔1秒，固定执行一次(如果发现上次执行还未完毕，则等待完毕，等上一次执行完毕后再开始计时，等待1秒)。`

executor.shutdown(); //调用shutdown后，不接收新的任务，等待13任务执行结束。追加的任务在线程池关闭后，无法再提交，会被拒绝执行
executor.shutdownNow(); //调用shutdownnow后，队列中的3个线程不再执行，10个线程被终止。追加的任务在线程池关闭后，无法再提交，会被拒绝执行