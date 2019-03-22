---
title: Jquery插件扩展
date: 2019-03-22 14:15:59
tags: [JavaScript,Jquery]
---

我们平时会使用别人提供的一些Jquery组件来减轻开发工作。如：
``` js
$.alert({title:'标题',content:'内容'});
$('#main').loading();
```
那么这些组件是如何编写的呢？

<!-- more -->


# JQuery插件扩展
我们平时会使用别人提供的一些Jquery组件来减轻开发工作。如：
``` js
$.alert({title:'标题',content:'内容'});
$('#main').loading();
```
那么这些组件是如何编写的呢？

以下介绍Jquery提供的两种插件扩展方式：

## $.extend()
`$.extend`不仅可以用来合并两个对象，也可以用来扩展JQuery方法。

它可以往`$`对象中添加一个对象，之后我们就可以通过`$.xxx`来使用它，如同一个普通函数。

假设我们现在需要自定义一个弹窗组件，我们需要做如下准备：
1. 编写弹窗的css样式；
2. 提供一个`$.alertDefault`保存默认参数；
3. 实现`$.aler()`函数；

具体代码如下：

``` html 
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JQuery插件扩展</title>
<script src="http://libs.baidu.com/jquery/1.9.0/jquery.min.js"></script>
<style>
/* 1. 编写弹窗样式 */
html, body {
  height: 100%;
}

.modal-cover {
  position: fixed;
  overflow: auto;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.2);
}

.modal-cover.hide {
  display: none;
}

.modal {
  position: absolute;
  min-width: 600px;
  min-height: 180px;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 0 8px 0 #828282;
}

.modal .header {
  font-weight: bolder;
  border-bottom: 1px solid #cccccc;
  padding: 10px 20px;
}

.modal .close {
  position: absolute;
  top: 3px;
  right: 20px;
  font-size: 25px;
  cursor: pointer;
}

.modal .main {
  padding: 15px 20px;
  max-height: 100%;
  position: relative;
  display: inline-block;
  width: 100%;
  box-sizing: border-box;
}

.modal .footer {
  text-align: center;
  margin: 20px 0;
  position: relative;
}

.modal .footer button {
  border: 1px solid;
  border-radius: 4px;
  padding: 2px 15px;
  margin-left: 10px;
  width: 120px;
  height: 30px;
  cursor: pointer;
  background-color: #62259d;
  color: #ffffff;
  border-color: #62259d;
}
</style>
</head>
<body>
<button id="button">打开自定义弹窗</button>
</body>
<script>
(function($){
  $.extend({
    /* 2. 设置弹窗默认参数，用户可以通过修改$.alertDefault来修改全局的默认参数 */
    alertDefault: {
      id: 'alert-0',
      title: '提示',
      content: '',
      okLabel: '确认'
    },
    /* 3. 弹窗组件的实现 */
    alert: function(options){
      // 合并用户参数和默认参数
      options = $.extend(true, {}, $.alertDefault, options || {});
      // 创建弹窗html
      var alertHtml = '<div class="modal-cover hide" id="' + options.id + '">' +
            '<div class="modal">' +
              '<div class="header">' +
                '<div class="title">' + options.title + '</div>' +
                '<span class="close">&times;</span>' +
              '</div>' +
              '<div class="main">' + options.content + '</div>' +
              '<div class="footer">' +
                '<button class="ok">' + options.okLabel + '</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      // 将弹窗html插入<body>，若已存在则修改其html
      var _alert = $('#' + options.id);
      if (!_alert.length) {
          $('body').append(alertHtml);
      } else {
          _alert.prop('outerHTML', alertHtml);
      }
      _alert = $('#' + options.id);
      // 绑定关闭对话框函数
      _alert.find('.close,.ok').on('click', function () {
        _alert.addClass('hide');
      });
      // 显示对话框
      _alert.removeClass('hide');
    }
  });
})(jQuery);

$('#button').on('click', function(){
  /* 4. 调用组件的方法 */
  $.alert({
    title: '自定义标题',
    content: '自定义内容'
  });
});
</script>
</html>
```


## $.fn.*
`$.fn`可以为选择器的所有元素扩展一个方法。

::: tip 示例
如我们定义了`$.fn.loading()`，则可以使用`$('div').loading()`为所有的`<div>`元素调用该方法。
:::

为了实现元素的加载特效：`$.fn.loading()`，我们需要：
1. 编写加载样式；
2. 实现`Loading`对象；
3. 为`$.fn`的每个元素添加`Loading`对象；
4. 设置`$.fn.loading.defaults`默认参数；


``` html 
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JQuery插件扩展</title>
<script src="http://libs.baidu.com/jquery/1.9.0/jquery.min.js"></script>
<style>
/* 1. 编写加载效果样式 */
html, body {
  height: 100%;
  margin: 0;
}

.loading-container {
  position: relative;
}

.loading-cover {
  position: absolute;
  background: #6868687a;
  z-index: 15;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
}

.loading-cover.hide {
  display: none;
}

.loading-cover .loading-body {
  position: relative;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  position: absolute;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.27);
  border-radius: 7px;
  padding: 15px 25px;
  font-size: 24px;
  color: #666;
  background: #ffffff;
  text-align: center;
}
</style>
</head>
<body>
  <button id="button">显示加载效果</button>
</body>
<script>
(function($){
  /* 2. 定义Loading对象 */
  function Loading($el, options) {
    this.$el = $el;
    this.options = options;
  }
  Loading.prototype = {
    constructor: Loading,
    init: function () {
      // 将html插入要显示加载效果的元素中
      if (!this.lid) {
        this.lid = new Date().getTime();
        if (this.$el.css('position') === 'static' && !this.$el.is('body') && !this.$el.is('html')) {
          this.$el.addClass('loading-container');
        }
        this.$el.append('<div id="' + this.lid + '" class="loading-cover hide"></div>');
      }
      this.$load = $('#' + this.lid);
      this.$load.html('<div class="loading-body">' + this.options.text + '</div>');
    },
    show: function () {
      this.$load.removeClass('hide');
    },
    hide: function () {
      this.$load.addClass('hide');
    }
  };
  /* 3. 实现插件扩展 */
  $.fn.loading = function () {
    // 获取参数
    var option = arguments[0],
        value,
        allowedMethods = ['show', 'hide'];
    // 遍历所有选择器对象
    this.each(function () {
      var $this = $(this),
        data = $this.data('loading'),
        options = $.extend(true, {}, $.fn.loading.defaults, typeof option === 'object' && option);
      // 利用$.data存储Loading对象，若不存在则需要初始化
      if (!data) {
        data = new Loading($this, options);
        $this.data('loading', data);
        data.init();
      }
      // 若参数是string则调用对应方法
      if (typeof option === 'string') {
        if ($.inArray(option, allowedMethods) < 0) {
          throw 'Unknown method: ' + option;
        }
        value = data[option]();
      } else {
        options.autoShow && data.show();
      }
    });
    return typeof value !== 'undefined' ? value : this;
  };
  /* 4. 指定默认参数 */
  $.fn.loading.defaults = {
    'autoShow': true,
    'text': 'Loading ...'
  };
})(jQuery);

$('#button').on('click', function(){
  /* 5.1 初次调用，可设置参数，或使用默认参数 */
  $('body').loading();
  setTimeout(function(){
    /* 5.2 后续调用 */
    $('body').loading('hide');
  }, 2000);
});
</script>
</html>
```
