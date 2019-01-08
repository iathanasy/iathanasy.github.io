---
title: 在多台电脑间使用hexo
date: 2019-01-07 10:04:30
tags: [Hexo,GitHub]
---

通过 git 的分支实现。hexo 生成的静态博客文件默认放在 master 分支上，可以新创建一个 hexo 分支，把 hexo 的源文件都放在 hexo 分支上，换新电脑时，直接 git clone hexo 分支即可。

<!--more-->

### 背景：
这个博客最初是还在学校的时候，使用 `hexo + github pages` 构建，代码都在我的笔记本里。

### 需求：
工作以后大部分时间都是在用办公室里的电脑，现在想在笔记本和办公室的电脑上都能用hexo写博客。

### 思路：
通过 git 的分支实现。hexo 生成的静态博客文件默认放在 master 分支上，可以新创建一个 hexo 分支，把 hexo 的源文件都放在 hexo 分支上，换新电脑时，直接 git clone hexo 分支即可。


## 1.分析
新建一个 hexo 分支，把 hexo 的源文件都放到这个分支上。但是源文件有70多M，并不需要把所有文件都放在分支上。`node_modules`目录可以用 `npm install` 命令生成，`public`目录可以使用 `hexo g` 命令生成，`.deploy_git`目录是`hexo d`命令生成，所以可以把这三个目录放在 `.gitignore` 里忽略提交。

## 2.操作

#### 在原来的笔记本上：

1.创建新的分支 hexo 并切换到这个分支上。

2.在博客的目录下创建 `.gitignore` 文件，在文件里写入：

```
node_modules/
public/
.deploy_git/
```

3.在 hexo 分支下，git add、git commit 提交所有文件，最后把 hexo 分支 push 到 github 上。这时 github 上有两个分支：master 和 hexo，master 分支是博客的静态文件，hexo 分支是博客的源代码。

#### 在新电脑上：

1.安装 git。在 git bash 下输入以下命令配置用户名和邮箱，邮箱是自己 github 账号的邮箱：

```
git config --global user.name "Your Name"
git config --global user.email "email@example.com"
```

2.执行以下命令生成 SSH key：

```
ssh-keygen -t rsa -C "youremail@example.com"
```

其中 `youremail@example.com` 是你的 github 邮箱，剩下的一路回车即可。最后会在用户主目录下生成一个 `.ssh` 目录，该目录下有 `id_rsa` 和 `id_rsa.pub` 两个文件，这两个文件就是 SSH 的密钥对，`id_rsa` 是私钥，`id_rsa.pub` 是公钥。

3.登录 github，在 settings 里找到 SSH and GPG keys，创建新的 SSH key，title 可以是任意值，key 文本框里粘贴 id_rsa.pub 里的内容，最后保存。

4.安装 Node.js。在 git bash 里输入以下命令安装 hexo：

```
npm install hexo-cli -g
```

5.新建博客目录，在该目录打开 git bash，执行：

```
git init
```

初始化该目录。

6.使用 git clone 把 github 上的 hexo 分支复制到博客目录。指明如下：

```
git clone -b hexo git@github.com:xxx/xxx.github.io.git
```

**注意默认 git clone 命令只会复制 master 分支，这里需要用 -b 指明只克隆 hexo 分支。因为源代码都放在了hexo分支上，并不需要对master分支进行操作。**

7.克隆完以后，执行 

```
npm install
```

安装所有依赖（生成 `node_modules` 目录）。

8.执行

```
hexo g
```

生成博客的静态文件（即 `public` 目录）

9.执行

```
hexo new post "文章标题"
```

创建新文章，然后可以在 `source/_posts/` 目录下找到对应的文章并可以编辑。

10.执行

```
hexo s
```

运行 hexo 服务器，在浏览器中打开 http://localhost:4000 查看博客是否已经可以运行。

11.执行

```
hexo d
```

可以把博客的静态文件部署到 github 上。

**注意在 _config.yml 中 deploy 的 branch 值必须为 master，指明 hexo d 命令是把博客静态文件推到 master 分支上。**

12.最后把修改推到 github 上的 hexo 分支：

```
git add .
git commit -m "commit message"
git push origin hexo
```

**注意：以上所有操作都是在 hexo分支下操作的。**

## 3.日常操作流程
1.换到不同电脑上时，首先拉下 github 上的 hexo分支的更新：
```
git pull origin hexo 
```

2.编写、修改博客，并使用 `hexo d` 命令部署。

3.把对文件的修改推送到 github 的hexo分支上：
```
git add .
git commit -m "commit message"
git push origin hexo
```