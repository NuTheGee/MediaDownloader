////////////////////////////////////////
//  v0.2.0
////////////////////////////////////////

function getCurrentTabUrl(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    var url = tab.url;
    console.assert(typeof url == 'string', 'tab.url should be a string');
    callback(url);
  });
}

function getData(param, callback) {
    var searchUrl = (param.https)? "https://": "http://";
    searchUrl += param.host + param.path;
    var x = new XMLHttpRequest();
    x.open('GET', searchUrl);
    x.onload = function() {
        var response = x.response;
        callback(response);
    };
    x.onerror = function() {
        putContent("status", "http: 잘못된 URL입니다.");
    };
    x.send();
}

function putContent(id, content) {
  document.getElementById(id).textContent = content;
}

function putList(id, list) {
    var target = document.getElementById(id);
    var ul = document.createElement("ul");
    for(var i = 0; i < list.length; i++){
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.appendChild(document.createTextNode(list[i].label + " " + list[i].type));
        a.target = "_blank";
        a.href = list[i].url;
        li.appendChild(a);
        ul.appendChild(li);
    }
    target.appendChild(ul);
}

////////////////////////////////////////

var Youtube = {
    host: "youtube.com",
    regex: {
        ext_id: /[\?&]v=([a-zA-Z0-9_-]+)&?/,
        data: /ytplayer.config = ({.+?});ytplayer.load/
    },
    param: {
        https: true,
        host: "www.youtube.com",
        header: {},
        path: "/watch?v="
    },
    method: function(){
        Youtube.param.path += Video.ext_id;
        getData(Youtube.param, function(data){
            var match = Youtube.regex.data.exec(data);
            if(match){
                var obj = JSON.parse(match[1]);
                Video.url.path_js = obj.assets.js;
                Video.info.title = obj.args.title;
                Video.info.user = obj.args.author;
                var sources = obj.args.url_encoded_fmt_stream_map.split(",");
                for(var i in sources){
                    var temp = {};
                    var items = sources[i].split("&");
                    for(var j in items){
                        var pair = items[j].split("=");
                        temp[pair[0]] = pair[1];
                    }
                    var clen_match = /&clen=([0-9]+)&/.exec(unescape(temp.url));
                    Video.sources.push({
                        size: (clen_match)? clen_match[1]: "",
                        label: temp.quality + " video and audio",
                        type: unescape(temp.type).split(";")[0].split("/")[1],
                        url: unescape(temp.url),
                        sig: temp.s,
                    });
                }
                var sources = obj.args.adaptive_fmts.split(",");
                for(var i in sources){
                    var temp = {};
                    var items = sources[i].split("&");
                    for(var j in items){
                        var pair = items[j].split("=");
                        temp[pair[0]] = pair[1];
                    }
                    Video.sources.push({
                        size: temp.clen, 
                        label: (temp.quality_label)? temp.quality_label + " only video": "only audio",
                        type: unescape(temp.type).split(";")[0].split("/")[1], 
                        url: unescape(temp.url),
                        sig: temp.s,
                    });
                }
                Youtube.param.path = Video.url.path_js;
                getData(Youtube.param, function(data){
                    data = data.replace(/[\r\n]/g, "");
                    var rex_0 = /\("signature",(.+?)\(.+?\)\)/;
                    var target_0 = rex_0.exec(data)[1];
                    target_0 = target_0.replace("$", "\\$");
                    var rex_1 = new RegExp("(" + target_0 + "=function.+?\\)};)");
                    var code_1 = rex_1.exec(data)[1];
                    Video.script += code_1.replace(target_0, "sign");
                    var rex_2 = new RegExp(";([A-Za-z]+?)\\.");
                    var target_1 = rex_2.exec(code_1)[1];
                    var rex_3 = new RegExp("(var " + target_1 + "={.+?};)");
                    var code_2 = rex_3.exec(data)[1];
                    Video.script += code_2;
                    eval(Video.script);
                    for(var i in Video.sources){
                        if(Video.sources[i].sig){
                            Video.sources[i].url += "&signature=" + sign(Video.sources[i].sig);
                        }
                    }
                    putList("result", Video.sources);
                });
                Video.status = "get data success";
            }
            else{
                Video.status = "get data failure"; 
            }
        });
    },
};

var Facebook = {
    host: "facebook.com",
    regex: {
        ext_id: /videos.*\/([0-9]+)\//,
        user_id: /\/([a-zA-Z0-9]+)\/videos/,
        data: [
            /dash_manifest:"(.+?)",/,
            /mimeType="(.+?)".+?(?:FBQualityLabel="(.+?)")?><BaseURL>(.+?)<\/BaseURL>/g,
        ],
        title: /<meta name="description" content="(.+?)" ?\/>/,
        user: /ownerName:"(.+?)",/,
    },
    param: {
        https: true, 
        host: "www.facebook.com", 
        header: {"User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:51.0) Gecko/20100101 Firefox/51.0"}, 
        path: "/",
    },
    method: function(){
        Video.user_id = Facebook.regex.user_id.exec(Video.url.ext)[1];
        Facebook.param.path += Video.user_id + "/videos/" + Video.ext_id;
        getData(Facebook.param, function(data){
            Video.info.title = Facebook.regex.title.exec(data)[1].replace(/&#039;/g, "'");
            Video.info.user = Facebook.regex.user.exec(data)[1];
            var match = /hd_src:"(.+?)"/.exec(data);
            Video.sources.push({
                type: "mp4",
                label: "hd video and audio",
                url: match[1],
            });
            match = /sd_src:"(.+?)"/.exec(data);
            Video.sources.push({
                type: "mp4",
                label: "sd video and audio",
                url: match[1],
            });
            var xml = Facebook.regex.data[0].exec(data)[1];
            xml = xml.replace(/\\x3C/g, "<").replace(/\\"/g, '"').replace(/&amp;/g, "&").replace(/\\n/g, "");
            match = Facebook.regex.data[1].exec(xml);
            while(match != null){
                Video.sources.push({
                    type: match[1].split("/")[1],
                    label: (match[2])? match[2] + " only video": "only audio",
                    url: match[3],
                });
                match = Facebook.regex.data[1].exec(xml);
            }
            putList("result", Video.sources);
            Video.status = "get data success";
        });
    },
};

var NaverTV = {
    host: "tv.naver.com",
    regex: {
        ext_id: /\/v\/([0-9]+)\/?/,
        key: /vid=(.+)&outKey=(.+?)&/,
    },
    param_0: {
        host: "tv.naver.com", 
        path: "/v/",
    },
    param_1: {
        host: "play.rmcnmv.naver.com", 
        path: "/vod/play/",
    },
    method: function(){
        NaverTV.param_0.path += Video.ext_id;
        getData(NaverTV.param_0, function(data){
            var match = NaverTV.regex.key.exec(data);
            Video.vid = match[1];
            Video.key = match[2];
            NaverTV.param_1.path += Video.vid + "?key=" + Video.key;
            Video.url.info = "http://" + NaverTV.param_1.host + NaverTV.param_1.path;
            getData(NaverTV.param_1, function(data){
                var obj = JSON.parse(data);
                Video.info.title = obj.meta.subject;
                Video.info.user = obj.meta.user.name;
                Video.url.thumbnail = obj.meta.cover.source;
                var target = obj.videos.list;
                for(var i in target){
                    Video.sources.push({
                        type: "mp4",
                        size: target[i].size,
                        url: target[i].source,
                        label: target[i].encodingOption.name + " video and audio",
                    });
                }
                putList("result", Video.sources);
                Video.status = "get data success";
            });
        });
    },
};

var NaverSports = {
    host: "sports.news.naver.com",
    regex: {
        ext_id: /[\?&]id=([0-9]+)&?/,
        category: /\/([a-z]+?)\/vod/,
        key: /RMCVideoPlayer\('(.+?)', \{\s+'value': '(.+?)',/,
    },
    param_0: {
        host: "sports.news.naver.com", 
        path: "/vod/index.nhn",
    },
    param_1: {
        host: "play.rmcnmv.naver.com", 
        path: "/vod/play/",
    },
    method: function(){
        Video.category = NaverSports.regex.category.exec(Video.url.ext)[1];
        NaverSports.param_0.path = "/" + Video.category + NaverSports.param_0.path + "?id=" + Video.ext_id;
        getData(NaverSports.param_0, function(data){
            var match = NaverSports.regex.key.exec(data);
            Video.vid = match[1];
            Video.key = match[2];
            NaverSports.param_1.path += Video.vid + "?key=" + Video.key;
            Video.url.info = "http://" + NaverSports.param_1.host + NaverSports.param_1.path;
            getData(NaverSports.param_1, function(data){
                var obj = JSON.parse(data);
                Video.info.title = obj.meta.subject;
                Video.info.user = obj.meta.user.name;
                Video.url.thumbnail = obj.meta.cover.source;
                var target = obj.videos.list;
                for(var i in target){
                    Video.sources.push({
                        type: "mp4",
                        size: target[i].size,
                        url: target[i].source,
                        label: target[i].encodingOption.name + " video and audio",
                    });
                }
                putList("result", Video.sources);
                Video.status = "get data success";
            });
        });
    },
};

////////////////////////////////////////

var Config = {
    domain: {
        youtube: Youtube,
        facebook: Facebook,
        navertv: NaverTV,
        naversports: NaverSports,
    },
};

var Video = {
    domain: "",
    ext_id: "",
    url: {},
    info: {},
    sources: [],
    status: "ready",
    script: "",
    
    init: function(url){
        this.url.ext = url;
        for(key in Config.domain){
            if(url.includes(Config.domain[key].host)){
                this.domain = key;
                this.status = "domain detected";
                var config = Config.domain[key];
                var match = config.regex.ext_id.exec(url);
                if(match){
                    this.ext_id = match[1];
                    this.status = "external id found";
                }
                else{
                    this.status = "external id not found";
                }
                putContent("status", this.domain + ": " + this.ext_id);
                return;
            }
        }
        this.status = "doamin unsupported";
    },
    
    get: function(){
        var config = Config.domain[this.domain];
        config.method();
    },
};

////////////////////////////////////////

document.addEventListener('DOMContentLoaded', function() {
    getCurrentTabUrl(function(url) {
        Video.init(url);
        Video.get();
    });
});

chrome.downloads.onDeterminingFilename.addListener(function(item, suggest) {
  suggest({filename: Video.info.user + "_" + Video.info.title + "_" + item.fileSize + "." + item.mime.split("/")[1],
           conflictAction: "uniquify"});
});
