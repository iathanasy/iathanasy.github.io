---
title: JAVA锁
date: 2020-03-08 14:51:31
tags: [Java,Java锁]
---

<!-- more -->

### 什么地方需要加锁？
判断线程安全（临界区、竞态条件、共享资源）
1. 多个线程访问相同资源，向这些资源做了写操作 线程不安全
2. 栈封闭时，不会在线程之间共享变量。线程安全
3. 局部对象引用本身不共享，但是引用对象存储在共享堆中。如果方法内创建对象，只是在方法中传递，
并不对其他线程可用，那么也是线程安全的。  

<font style="color:red">判定规则：如果创建、使用和处理资源，永远不会逃脱单个线程的控制，该资源的使用是线程安全的。</font>

### Java中锁的概念
1. 自旋锁(cas) ： 是指当一个线程在获取锁的时候，如果锁已经被其他线程获取，那么该线程将循环等待，然后不断判断锁是否能够被成功获取，直到获取到锁才会退出循环。

2. 乐观锁 ： 假定没有冲突，在修改数据时如果发现数据和之前获取的不一致，则读最新数据，修改后重试修改

3. 悲观锁 ：假定会发生并发冲突，同步所有对数据的相关操作，从读数据就开始上锁

4. 独享锁（写） ： 给资源加上写锁，拥有该锁的线程可以修改资源，其他线程不能再加锁（单写）

5. 共享锁（读） ： 给资源加上读锁后只能读不能改，其他线程也只能加读锁，不能加写锁 （多读）

6. 可重入锁 ：线程拿到一把锁后，可以自由进入同一把锁所同步的代码

7. 不可重入锁 ：线程拿到一把锁后，不可以自由进入同一把锁所同步的代码

8. 公平锁 ：争抢锁的顺序，按照先来后到的顺序

9. 非公平锁 ：争抢锁的顺序，不按照先来后到的顺序

Java中几种重要的锁实现方式：synchronized, ReentrantLock, ReentrantReadWriteLock

### synchronized(同步)

	//锁 方法(静态/非静态),代码块(对象/类)
	static Object temp = new Object();

	//public synchronized void test1() {//并行
	//public static synchronized void test1() {//同步
	 public void test1() {
		synchronized (ObjectSyncDemo1.class) { //同步
		//synchronized (this){ //并行
		//synchronized(temp){//同步
		main
		Thread(()>{new ObjectSyncDemo().test()});

### 自旋锁(CAS)

	volatile int value = 0;

    static Unsafe unsafe; // 直接操作内存，修改对象，数组内存....强大的API
    private static long valueOffset;
	static {
        try {
            // 反射技术获取unsafe值
            Field field = Unsafe.class.getDeclaredField("theUnsafe");
            field.setAccessible(true);
            unsafe = (Unsafe) field.get(null);

            // 获取到 value 属性偏移量（用于定于value属性在内存中的具体地址）
            valueOffset = unsafe.objectFieldOffset(LockDemo1.class
                    .getDeclaredField("value"));

        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }
	public void add() {
        // TODO xx00
        // i++;// JAVA 层面三个步骤
        // CAS + 循环 重试
        int current;
        do {
            // 操作耗时的话， 那么 线程就会占用大量的CPU执行时间
            current = unsafe.getIntVolatile(this, valueOffset);
        } while (!unsafe.compareAndSwapInt(this, valueOffset, current, current + 1));
        // 可能会失败
    }
	
	
### ReentrantReadWriteLock(读写锁)

	//读写锁（既保证了读数据的效率，也保证数据的一致性）
	ReentrantReadWriteLock readWriteLock = new ReentrantReadWriteLock();
	
	// 多线程读，共享锁
    public void read(Thread thread) {
        readWriteLock.readLock().lock();
        try {
            long start = System.currentTimeMillis();
            while (System.currentTimeMillis() - start <= 1) {
                System.out.println(thread.getName() + "正在进行“读”操作");
            }
            System.out.println(thread.getName() + "“读”操作完毕");
        } finally {
            readWriteLock.readLock().unlock();
        }
    }
	
	/**
     * 写
     */
    public void write(Thread thread) {
        readWriteLock.writeLock().lock();
        try {
            long start = System.currentTimeMillis();
            while (System.currentTimeMillis() - start <= 1) {
                System.out.println(thread.getName() + "正在进行“写”操作");
            }
            System.out.println(thread.getName() + "“写”操作完毕");
        } finally {
            readWriteLock.writeLock().unlock();
        }
    }
	
### condition实现队列线程安全


	final Lock lock = new ReentrantLock();
    // 指定条件的等待 - 等待有空位
    final Condition notFull = lock.newCondition();
    // 指定条件的等待 - 等待不为空
    final Condition notEmpty = lock.newCondition();

    // 定义数组存储数据
    final Object[] items = new Object[100];
    int putptr, takeptr, count;

    // 写入数据的线程,写入进来
    public void put(Object x) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length) // 数据写满了
                notFull.await(); // 写入数据的线程,进入阻塞
            items[putptr] = x;
            if (++putptr == items.length) putptr = 0;
            ++count;
            notEmpty.signal(); // 唤醒指定的读取线程
        } finally {
            lock.unlock();
        }
    }
    // 读取数据的线程,调用take
    public Object take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0)
                notEmpty.await(); // 线程阻塞在这里,等待被唤醒
            Object x = items[takeptr];
            if (++takeptr == items.length) takeptr = 0;
            --count;
            notFull.signal(); // 通知写入数据的线程,告诉他们取走了数据,继续写入
            return x;
        } finally {
            lock.unlock();
        }
    }
	
### java.util.concurrent.atomic 保证原子性操作基于CAS实现


### 抽象队列同步器(AQS)
锁

	// 抽象队列同步器
	// state， owner， waiters
	public class NeteaseAqs {
		// acquire、 acquireShared ： 定义了资源争用的逻辑，如果没拿到，则等待。
		// tryAcquire、 tryAcquireShared ： 实际执行占用资源的操作，如何判定一个由使用者具体去实现。
		// release、 releaseShared ： 定义释放资源的逻辑，释放之后，通知后续节点进行争抢。
		// tryRelease、 tryReleaseShared： 实际执行资源释放的操作，具体的AQS使用者去实现。

		// 1、 如何判断一个资源的拥有者
		public volatile AtomicReference<Thread> owner = new AtomicReference<>();
		// 保存 正在等待的线程
		public volatile LinkedBlockingQueue<Thread> waiters = new LinkedBlockingQueue<>();
		// 记录资源状态
		public volatile AtomicInteger state = new AtomicInteger(0);

		// 共享资源占用的逻辑，返回资源的占用情况
		public int tryAcquireShared(){
			throw new UnsupportedOperationException();
		}

		public void acquireShared(){
			boolean addQ = true;
			while(tryAcquireShared() < 0) {
				if (addQ) {
					// 没拿到锁，加入到等待集合
					waiters.offer(Thread.currentThread());
					addQ = false;
				} else {
					// 阻塞 挂起当前的线程，不要继续往下跑了
					LockSupport.park(); // 伪唤醒，就是非unpark唤醒的
				}
			}
			waiters.remove(Thread.currentThread()); // 把线程移除
		}

		public boolean tryReleaseShared(){
			throw new UnsupportedOperationException();
		}

		public void releaseShared(){
			if (tryReleaseShared()) {
				// 通知等待者
				Iterator<Thread> iterator = waiters.iterator();
				while (iterator.hasNext()) {
					Thread next = iterator.next();
					LockSupport.unpark(next); // 唤醒
				}
			}
		}

		// 独占资源相关的代码

		public boolean tryAcquire() { // 交给使用者去实现。 模板方法设计模式
			throw new UnsupportedOperationException();
		}

		public void acquire() {
			boolean addQ = true;
			while (!tryAcquire()) {
				if (addQ) {
					// 没拿到锁，加入到等待集合
					waiters.offer(Thread.currentThread());
					addQ = false;
				} else {
					// 阻塞 挂起当前的线程，不要继续往下跑了
					LockSupport.park(); // 伪唤醒，就是非unpark唤醒的
				}
			}
			waiters.remove(Thread.currentThread()); // 把线程移除
		}

		public boolean tryRelease() {
			throw new UnsupportedOperationException();
		}

		public void release() { // 定义了 释放资源之后要做的操作
			if (tryRelease()) {
				// 通知等待者
				Iterator<Thread> iterator = waiters.iterator();
				while (iterator.hasNext()) {
					Thread next = iterator.next();
					LockSupport.unpark(next); // 唤醒
				}
			}
		}

		public AtomicInteger getState() {
			return state;
		}

		public void setState(AtomicInteger state) {
			this.state = state;
		}
	}  


	// 自己实现(独享锁) - 常用的
	public class TonyLock implements Lock {
		// 抽象工具类AQS
		NeteaseAqs aqs = new NeteaseAqs(){
			@Override
			public boolean tryAcquire() {
				return owner.compareAndSet(null, Thread.currentThread());
			}

			@Override
			public boolean tryRelease() {
				// 可重入的情况下，要判断资源的占用情况（state字段保存了资源的占用次数）
				return owner.compareAndSet(Thread.currentThread(), null);
			}
		};

		@Override
		public boolean tryLock() {
			return aqs.tryAcquire();
		}

		@Override
		public void lock() {
			aqs.acquire();
		}

		@Override
		public void unlock() {
			aqs.release();
		}

		@Override
		public void lockInterruptibly() throws InterruptedException {

		}

		@Override
		public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
			return false;
		}

		@Override
		public Condition newCondition() {
			return null;
		}
	}
	
	

### CountDownLatch(倒计时 门栓)
> 1.使一个线程等待其他线程各自执行完毕后再执行.  
  2.是通过一个计数器来实现的，计数器的初始值是线程的数量。每当一个线程执行完毕后，计数器的值就-1，当计数器的值为0时，表示所有线程都执行完毕，然后在闭锁上等待的线程就可以恢复工作了。

	//参数count为计数值
	public CountDownLatch(int count) {  };  
	
	//调用await()方法的线程会被挂起，它会等待直到count值为0才继续执行
	public void await() throws InterruptedException { };   
	//和await()类似，只不过等待一定的时间后count值还没变为0的话就会继续执行
	public boolean await(long timeout, TimeUnit unit) throws InterruptedException { };  
	//将count值减1
	public void countDown() { };  
	
	 
	//使用
	CountDownLatch cd = new CountDownLatch(10); // 创建，计数数值
	
	for 10 new Thread(() -> {cd.countDown(); // 参与计数}).start();
	cd.await(); // 等待计数器为0
	sout("全部执行完毕！");

### CyclicBarrier(栅栏)
> 让一组线程到达一个屏障时被阻塞，知道最后一个线程到达屏障，所有被屏障拦截的线程才会继续执行。  

	// 每当有4个线程处于await状态的时候，则会触发barrierAction执行
	CyclicBarrier barrier = new CyclicBarrier(4, ()->{
		sout("System.out.println("有4个线程执行了");
	});
	for 10 new Thread(() -> {barrier.await(); // 等待栅栏打开,有4个线程都执行到这段代码的时候，才会继续往下执行; // 参与计数}).start();

### Semaphore(信号量)  
> 可用于限流  
	
	//限流 控制5个线程 同时访问
	NeteaseSemaphore semaphore = new NeteaseSemaphore(5); // 手牌数量，限制请求数量
	for 10 new Thread(() -> {
		semaphore.acquire(); // 获取令牌
		sout("访客来了");
		semaphore.release(); // 释放令牌
	}).start();