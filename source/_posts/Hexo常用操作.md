---
title: Hexo常用操作
date: 2019-01-07 11:38:49
tags: [Hexo]
---
Hexo 有三种默认布局：post、page 和 draft，它们分别对应不同的路径，而您自定义的其他布局和 post 相同，都将储存到 source/_posts 文件夹。

<!-- more -->

## iathanasy.github.io
## hexo 的一些配置文件
### 新电脑如果要安装的话需要执行以下步骤
  1.安装hexo：npm install -g hexo-cli。
  2.clone远程仓库到本地 git clone -b hexo git@github.com:iathanasy/iathanasy.github.io.git。//注意：默认 git clone 命令只会复制 master 分支，这里需要用 -b 指明只克隆 hexo 分支。因为源代码都放在了hexo分支上，并不需要对master分支进行操作。
  3.根据packge.json安装依赖npm install。 //注意此处不要用hexo init 不然会初始化
  4.本地生成网站并开启博客服务器：hexo g & hexo s。如果一切正常，此时打开浏览器输入http://localhost:4000/已经可以看到博客正常运行了。
  5.若报错需要执行：npm install hexo-deployer-git --save
    sudo npm install hexo-server //或者  sudo npm install hexo-renderer-sass
  
### 发布新文章的时候操作
  1.	hexo new post "文章标题"  //创建新文章，然后可以在 source/_posts/ 目录下找到对应的文章并可以编辑。
      hexo new page"pageName" #新建页面
      hexo generate #生成静态页面至public目录 hexo g
      hexo server #开启预览访问端口（默认端口4000，'ctrl + c'关闭server）hexo s
      hexo deploy #将.deploy目录部署到GitHub hexo d  //若执行命令hexo deploy仍然报错：无法连接git或找不到git，则执行如下命令来安装hexo-deployer-git: npm install hexo-deployer-git --save
      hexo help # 查看帮助 
      hexo version #查看Hexo的版本
      hexo clean           //清除缓存文件 (db.json) 和已生成的静态文件 (public)

  2.	hexo s //运行 hexo 服务器
  3.	hexo d //可以把博客的静态文件部署到 github 上。 //注意在 _config.yml 中 deploy 的 branch 值必须为 master，指明 hexo d 命令是把博客静态文件推到 master 分支上。
  4.  最后把修改推到 github 上的 hexo 分支：
      以后每次发布新文章或修改网站样式文件时，git add . & git commit -m "some description" & git push origin hexo即可把环境文件推送到hexo分支。
      然后再hexo g -d发布网站并推送静态文件到master分支。
      
### 换到不同电脑上时，首先拉下 github 上的 hexo分支的更新
  1.	git pull origin hexo
  2.  编写、修改博客，并使用 hexo d 命令部署。 //重复(发布新文章)上面的步骤