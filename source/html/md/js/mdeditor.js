var md = {};

(function ($) {
    $.fn.mdEditor = function (options) {
	
	var tools = options.tools;
	var editorElement = $(this);

	var width = options.width;
	var height = options.height;
	
	var fileUploadURL = options.url;
	
	var textareaContent = options.textareaName;

	if (!height) {
       height = 350;
    }
	
	if (!textareaContent) {
       textareaContent = "md_editor_content";
    }
	
	var uploadFileName = "smfile";
	
	/**保存到浏览器*/
	var storageKey = 'markdown_key'
	
	//全部工具
	var allTools = {
		"emoji": {
                "onclick": function (item, editor) {
					editorElement.find(".editor_sticker").toggle();// 显示或隐藏表情包
					
                },
                "title": "Emoji表情",
				"icons": "fa-smile-o"
        },
		"bold": {
                "onclick": function (item, editor) {
					var cursor    = editor.getCursor();
					var selection = editor.getSelection();
					editor.replaceSelection("**" + selection + "**");
					
					if(selection === "") {
						editor.setCursor(cursor.line, cursor.ch + 2);
					}
					
                },
                "title": "添加粗体",
				"icons": "fa-bold"
        },
		"italic": {
                "onclick": function (item, editor) {
					var cursor    = editor.getCursor();
					var selection = editor.getSelection();
					editor.replaceSelection("*" + selection + "*");
					
					if(selection === "") {
						editor.setCursor(cursor.line, cursor.ch + 1);
					}
                },
                "title": "添加斜体",
				"icons": "fa-italic"
        },
		"del": {
                "onclick": function (item, editor) {
					var cursor    = editor.getCursor();
					var selection = editor.getSelection();
					editor.replaceSelection("~~" + selection + "~~");
					
					if(selection === "") {
						editor.setCursor(cursor.line, cursor.ch + 2);
					}
                },
                "title": "添加删除线",
				"icons": "fa-strikethrough"
        },
		"h1": {
			"onclick": function (item, editor) {
				var cursor    = editor.getCursor();
				var selection = editor.getSelection();
				
				editor.replaceSelection("# " + selection);
				
			},
			"title": "标题1",
			"icons": "md_editor_bold",
			"icons_val": "h1"
		},
		"quote": {
			"onclick": function (item, editor) {
				var cursor    = editor.getCursor();
				var selection = editor.getSelection();
				if (cursor.ch !== 0){
					editor.setCursor(cursor.line, 0);
					editor.replaceSelection("> " + selection);
					editor.setCursor(cursor.line, cursor.ch + 2);
				}
				else{
					editor.replaceSelection("> " + selection);
				}
			},
			"title": "插入引用",
			"icons": "fa-quote-left"
		},
		
		"hr": {
			"onclick": function (item, editor) {
				var cursor    = editor.getCursor();
				var selection = editor.getSelection();
				
				editor.replaceSelection(((cursor.ch !== 0) ? "\n\n" : "\n") + "------------\n\n");
				
			},
			"title": "横线",
			"icons": "fa-minus"
		},
		"code": {
			"onclick": function (item, editor) {
				var cursor    = editor.getCursor();
				var selection = editor.getSelection();
				
				editor.replaceSelection("`" + selection + "`");
				if (selection === "") {
					editor.setCursor(cursor.line, cursor.ch + 1);
				}
			},
			"title": "行内代码",
			"icons": "fa-code"
		},
		"link": {
			"onclick": function (item, editor) {
				var cursor    = editor.getCursor();
				var selection = editor.getSelection();
				editor.replaceSelection("[" + selection + "](http://)");
				
				if(selection === "") {
					editor.setCursor(cursor.line, cursor.ch + 1);
				}
			},
			"title": "添加链接",
			"icons": "fa-link"
		},
		 "upload": {
			"onclick": function (item, editor) {
				$upload = item.find('upload input');
				$upload.off("change").on("change",function (e) {
				   var e = e || window.event;
				   //获取 文件 个数 取消的时候使用
				   files = $upload.get(0).files || e.target.files;
				   if(files.length>0){
					 uploadImg(files[0], editor);
				   }
				});

				$upload[0].click();
			}, "render": function () {
				html += "\t\t<span item='upload' title='文件上传'>\n" +
					"\t\t\t<upload>\n" +
					"\t\t\t\t<i class=\"fa fa-picture-o\"></i>\n" +
					"\t\t\t\t<input type='file' name='"+uploadFileName+"'/>" +
					"\t\t\t</upload>\n" +
					"\t\t</span>\n";
			},
			"title": "文件上传",
			"icons": "fa-picture-o"
		},
		"unordered-list": {
			"onclick": function (item, editor) {
				var cursor    = editor.getCursor();
				var selection = editor.getSelection();
				if (selection === "") {
					editor.replaceSelection("- " + selection);
				} else {
					var selectionText = selection.split("\n");

					for (var i = 0, len = selectionText.length; i < len; i++) 
					{
						selectionText[i] = (selectionText[i] === "") ? "" : "- " + selectionText[i];
					}

					editor.replaceSelection(selectionText.join("\n"));
				}
			},
			"title": "添加无序列表",
			"icons": "fa-list-ul"
		}
		,
		"ordered-list": {
			"onclick": function (item, editor) {
				var cursor    = editor.getCursor();
				var selection = editor.getSelection();
				if(selection === "") {
					editor.replaceSelection("1. " + selection);
				}else{
					var selectionText = selection.split("\n");

					for (var i = 0, len = selectionText.length; i < len; i++) 
					{
						selectionText[i] = (selectionText[i] === "") ? "" : (i+1) + ". " + selectionText[i];
					}

					editor.replaceSelection(selectionText.join("\n"));
				}
			},
			"title": "添加有序列表",
			"icons": "fa-list-ol"
		},
		"view": {
			"onclick": function (item, editor) {
				var editorInput = editorElement.find('.md_editor_input');
				editorInput.toggle();
				editorElement.find('.md_editor_output').css('width', editorInput.is(":hidden") ? "100%" : "50%");
			},
			"title": "预览",
			"icons": "fa-eye"
		},
		"table": {
			"onclick": function (item, editor) {
				
			},
			"title": "添加表格",
			"icons": "fa-table"
		},
		"code-block": {
			"onclick": function (item, editor) {
				
			},
			"title": "代码块（多语言风格）",
			"icons": "fa-file-code-o"
		},
		"fullscreen": {
			"onclick": function (item, editor) {
				editorElement.toggleClass('full_screen');

				// 编辑器全屏后高度自适应
				if (editorElement.hasClass('full_screen')) {
					editor.setSize(editorElement.width(), editorElement.height() - item.height());
					editorElement.find('.md_editor_output').height(editorElement.height() - item.height());
				} else {
					editor.setSize(width, height);
					editorElement.find('.md_editor_output').height(height-20);
				}
				
				
			},
			"title": "全屏",
			"icons": "fa-arrows-alt"
			
		}
	}

	if (!tools) {
		// 默认工具栏
		tools = ["emoji", "bold", "italic", "del", "h1", "hr","quote", "code","link", "upload", "unordered-list", "ordered-list", "table","code-block","view", "fullscreen"];
    }

	//mdeditor
    var html = "<div class='md_editor'>\n" +
           "\t<div class='md_editor_toolbar'>\n";

	$.each(tools, function (i, val) {
		if (allTools.hasOwnProperty(val)) {
			var item = allTools[val];

			// 单独渲染某项工具
			if (item.hasOwnProperty("render")) {
				item['render']();
			} else {
				iconsVal = item['icons_val'] ? item['icons_val'] : "";
				html += "\t\t<span item='" + val + "' title='" + item['title'] + "'>";
				html += "<i class=\"fa " + item['icons'] +"\">"+ iconsVal +"</i>";
                html += "</span>\n";
			}
		}
	});

	//加载中
	html += "<div class='loading hide'>\n"+
			"<div class='gif'></div>\n</div>";
		
	// 表情
	/*html += "\t\t<div class='md_editor_sticker'>\n" +
            "\t\t\t<div class='md_editor_sticker_images'></div>\n" +
            "\t\t\t<div class='md_editor_sticker_page'></div>\n" +
            "\t\t\t<div class='md_editor_sticker_footer'></div>\n" +
            "\t\t</div>\n";*/

	html += "\t</div>\n" +
		"\t<div class='md_editor_container'>\n";

	html += "\t\t<div class='md_editor_input'>\n" +
		"\t\t\t<textarea id='"+textareaContent+"' name='"+textareaContent+"'></textarea>\n" +
		"\t\t</div>\n" +
		"\t\t<div class='md_editor_output'><div class='markdown-body'></div></div>\n" +
		"\t</div>\n" +
		"</div>\n";

	editorElement.append(html);

	var editorToolbar = editorElement.find('.md_editor_toolbar');
	var toolBarItems = editorElement.find('span[item]');
	var editorArea = editorElement.find("#"+textareaContent);
	var editorView = editorElement.find(".md_editor_output .markdown-body");
	var editorSticker = editorElement.find(".md_editor_sticker");
	
	editorSticker.css("top", editorToolbar.height() + 3);
	
	// 进来读取浏览器缓存
	storageValue = localStorage.getItem(storageKey);
	if (storageValue) {
		var html = marked(storageValue);// 获取渲染后的html代码片段
		editorArea.val(storageValue);
		editorView.html(html);
		
		//Prism代码高亮 显示行号
		editorView.find('pre').addClass("line-numbers").css("white-space", "pre-wrap");
		editorView.find('pre code').each(function(i, block) {
		  Prism.highlightElement(block);
		});
	}

	// marked
    var markedRender = new marked.Renderer();
    marked.setOptions({
      renderer: markedRender,
      gfm: true, //允许 Git Hub标准的markdown. 默认为true。
      tables: true, //允许支持表格语法。该选项要求 gfm 为true。 默认为true。
      breaks: true,  //允许回车换行。该选项要求 gfm 为true。 默认为false。
      pedantic: false, //尽可能地兼容 markdown.pl的晦涩部分。不纠正原始模型任何的不良行为和错误。 默认为false。
      sanitize: false,// 对输出进行过滤（清理），将忽略任何已经输入的html代码（标签） 默认为false。
      smartLists: true, //使用比原生markdown更时髦的列表。 旧的列表将可能被作为pedantic的处理内容过滤掉. 默认为false。
      smartypants: false, //使用更为时髦的标点，比如在引用语法中加入破折号。 默认为false。
	  //使用 highlight 作为代码高亮
	  /**highlight: function (code, lang) { 
        return hljs.highlightAuto(code).value;
	  }**/
    });

	// CodeMirror
	var mdeditor = CodeMirror.fromTextArea(editorArea[0], {
		//mode: 'markdown', //编辑器语言
		mode: 'gfm',
		lineNumbers: true, //显示行号
		lineWrapping: true,	//代码折叠
		styleActiveLine: true,
		//theme: "default",//编辑器主题
		//theme: "base16-light",
		//快捷键
		extraKeys: {
					"Enter": "newlineAndIndentContinueMarkdownList",
					"Alt-Space": "autocomplete",//ctrl-space唤起智能提示
					"Ctrl-S": function (editor) {
						content = editor.getValue();
						//保存到浏览器
						localStorage.setItem(storageKey, content);
						
						console.log(content);
					},//保存
					"Ctrl-Z":function (editor) {
						editor.undo();
					},//undo 撤销（Ctrl+Z）
					"Ctrl-Y":function (editor) {
						editor.redo();
					},//Redo 重做（Ctrl+Y）

				}
	});

	mdeditor.on('change', editorOnHandler);

	mdeditor.setSize(width, height);
    editorElement.find('.md_editor_output').height(height-20);

	/**拖拽粘贴图片上传*/
	initPasteDragImg(editorElement.get(0),mdeditor);

	// 为所有的工具条的工具注册一个点击事件
	toolBarItems.click(function() {
		var itemName = $(this).attr("item");

		if (allTools.hasOwnProperty(itemName)) {
			var item = allTools[itemName];

			if (item.hasOwnProperty('onclick')) {
				item['onclick']($(this), mdeditor);// 触发每个工具的onclick方法
				mdeditor.focus();// 刷新编辑器光标位置
			}
		}
	});
	
	//滚动事件
	$(".CodeMirror-scroll").on('scroll', function(){
		$preview = $(".md_editor_output");
		var percentage = this.scrollTop / (this.scrollHeight - this.offsetHeight);
		var height = percentage * ($preview.get(0).scrollHeight - $preview.get(0).offsetHeight);
		$preview.scrollTop(height);
	});

	//代码高亮,图片处理
    function editorOnHandler(editor) {
		var content = editor.getValue();// 获取编辑器输入内容
		var html = marked(content);// 获取渲染后的html代码片段

		editorArea.val(content);
		editorView.html(html);
		
		//处理img图片
		/**editorView.html(replaceMarkDownHTMLImg(html));
		var imgs = editorView.find('img');
		imgs.load(function () {
			setMaxImageSize(this);
		});**/
		
		//Prism代码高亮 显示行号
		editorView.find('pre').addClass("line-numbers").css("white-space", "pre-wrap");
		editorView.find('pre code').each(function(i, block) {
		  Prism.highlightElement(block);
		});
		
		//保存到浏览器
		localStorage.setItem(storageKey, content);
    }

	/**
	 * 图片宽高自适应，设置图片的最大宽度和高度
	 * @param img
	 */
	function setMaxImageSize(img) {
		var width = $(img).width() > 0 ? $(img).width() : img.naturalWidth;
		var height = $(img).height() > 0 ? $(img).height() : img.naturalHeight;
		var editorViewWidth = editorView.width();

		if (width > editorViewWidth) {
			// 计算出原图的比率
			var ratio = width / height;

			// 设置最大宽度为当前div的宽度-10
			var maxWidth = editorViewWidth - 10;

			// 用最大宽度和比率计算出最大高度
			var maxHeight = maxWidth / ratio;

			// 设置图片的最大允许宽高值
			$(img).width(maxWidth);
			$(img).height(maxHeight);
		}
	}

	/**
	 * 图片处理
	 * @returns {string}
	 */
	var replaceMarkDownHTMLImg = function (html) {
		var reg = /<img src="(.*?)" alt="(.*?)\s*">?/img;
		var match = null;

		while (match = reg.exec(html)) {
			if (match.length == 3) {
				var imgStr = match[0];

				var start = html.substring(0, match.index);// 截取起始部分字符串

				var end = html.substring(match.index + imgStr.length);// 截取尾部

				var imgSrc = match[1]; // 图片地址

				var imgAlt = match[2]; // 图片alt

				var imgWidth = "";// 图片宽

				var imgHeight = "";// 图片高

				if (imgAlt != '' && imgAlt.indexOf("=") != -1) {
					var strs = imgAlt.substring(imgAlt.lastIndexOf('=') + 1).split("*");

					if (strs.length == 2) {
						imgWidth = strs[0] + "px";
						imgHeight = strs[1] + "px";

						imgAlt = imgAlt.substring(0, imgAlt.lastIndexOf('='));
					}

				}

				html = start + "<img src='" + imgSrc + "' alt='" + imgAlt.trim() + "' width='" + imgWidth + "' height='" + imgHeight + "' />" + end;
			}
		}
		return html;
	}
	
	
	/**
	 * 拖拽粘贴事件
	 * @returns {string}
	 */
	function initPasteDragImg(editorElement,editor){
        //var doc = document.getElementById(id);
		var doc = editorElement;
        doc.addEventListener('paste', function (event) {
            var items = (event.clipboardData || window.clipboardData).items;
            var file = null;
            if (items && items.length) {
                // 搜索剪切板items
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        file = items[i].getAsFile();
                        break;
                    }
                }
            } else {
                console.log("当前浏览器不支持");
                return;
            }
            if (!file) {
                console.log("粘贴内容非图片");
                return;
            }
            uploadImg(file, editor)
        });

        var dashboard = editorElement;
        dashboard.addEventListener("dragover", function (e) {
            e.preventDefault()
            e.stopPropagation()
        })
        dashboard.addEventListener("dragenter", function (e) {
            e.preventDefault()
            e.stopPropagation()
        })
        dashboard.addEventListener("drop", function (e) {
            e.preventDefault()
            e.stopPropagation()
            var files = this.files || e.dataTransfer.files;
            uploadImg(files[0], editor)
        })
    }

	/**
	 * SM.MS图片上传
	 */
    function uploadImg(file, editor) {
        var formData = new FormData();
        var fileName = new Date().getTime() + "." + file.name.split(".").pop();
        formData.append(uploadFileName, file, fileName);
		//准备请求数据，显示模态框
		$('div.loading').show();
		
        $.ajax({
            url: 'https://sm.ms/api/v2/upload',
            type: 'post',
            data: formData,
            cache: false,
			contentType: false,
			processData: false,
            dataType: 'json',
            success: function (res) {
				var data = res.data;
                if (res.success) {
                    //var prefix = data.isImage ? "!" : "";

                    var imgSize = "";

                    if (data.width && data.height) {
                        imgSize = " =" + data.width + "*" + data.height;
                    }
					str = "![" + data.filename + imgSize + "]" + "(" + data.url + ") ";
					editor.replaceSelection(str);
                } else {
					//重复图片数据
					if(res.code == 'image_repeated'){
						str = "![img]" + "(" + res.images + ") ";
						editor.replaceSelection(str);
					}else{
						alert(res.message);
					}
                }
				//请求完成，隐藏模态框
				$('div.loading').hide();
            },
			error: function () {
				//请求完成，隐藏模态框
				$('div.loading').hide();
			}
        });
    }
	
	/**
	 * 图片上传
	 */
    function uploadImg1(file, editor) {
        var formData = new FormData();
        var fileName = new Date().getTime() + "." + file.name.split(".").pop();
        formData.append('editormd-image-file', file, fileName);

        $.ajax({
            url: fileUploadURL,
            type: 'post',
            data: formData,
            processData: false,
            contentType: false,
            dataType: 'json',
            success: function (data) {
                if (data.error == 0) {
                    var prefix = data.isImage ? "!" : "";

                    var imgSize = "";

                    if (data.width && data.height) {
                        imgSize = " =" + data.width + "*" + data.height;
                    }
					str = prefix + "[" + data.filename + imgSize + "]" + "(" + data.url + ") ";
					editor.replaceSelection(str);
                } else {
                    alert(data.message);
                }

            }
        });
    }

	return mdeditor;
	};
})(jQuery);