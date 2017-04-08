var request = require("request");
var querystring = require("querystring");
var Message = require("./message-model");

module.exports.getMsgList = getMsgList;
module.exports.saveMsg = saveMsg;

/**
 * function getMsgList
 * @description get a message list from a wechat offical account
 * 
 * @param {Object} params 
 * - {String} __biz, a param of wechat offical account, e.g. "MjM5NTAyODc2MA=="
 * - {String} uin, a param of wechat offical account, e.g. "MjM1NTkyMzc2NA=="
 * - {String} key, a param with timeliness, e.g. "f8c1af6c27a9331b1283b5d94d588d985fb08de33e61d9c3355db8205b1e207e4e1ebb1112e71b3fd0ccb562ce1fe8af05d597e5de1211d2b27a45f85b7f28f8fef9aeddc0b0f980f09bb04076c50ea5",
 * - {Number} frommsgid, the beginning id of the msg in the list, e.g. 1000000279,
 * - {Number} count, the number of msgs in the list, e.g. 10
 * - {String} f, the format of the http response, should be "json"
 * @param {String} cookie , the cookie required to get access to wechat server, e.g. "wap_sid2=CLSWsuMIElxWeWhfLU80STI4SFp0VzRHSTljVTFUcHVFU3ZPckFwbW14VEp6NE14NHlOamVNWnZ6YkxlYnMtVFRZc2xob0s3WEtsRGlmS2pISVZ3SXVqSTA3UU9YNE1EQUFBfjCOpZ7HBQ=="
 * @param {String} [keyword] , the keyword which should be in the title of the msg, optional, e.g. "七言"
 * 
 * @return {Promise} payload
 * - {String} errMsg, e.g. "ok"
 * - {Number} isContinue, e.g. 1
 * - {Number} count, e.g. 10
 * - {Array} msgList, e.g. [{"author":..., "title":..., "contentUrl":..., "datetime":...}, ...]
 */
function getMsgList(params, cookie, keyword) {
  return new Promise(function (resolve, reject) {
    // prepare the options for the GET request
    var url = "http://mp.weixin.qq.com/mp/getmasssendmsg?" + querystring.stringify(params);
    var options = {
      url: url,
      headers: {
        Cookie: cookie
      }
    };
    // send the GET request to get the msg list JSON
    request(options, function (err, res, body) {
      if (err) {
        reject(err);
      } else if (res.statusCode !== 200) {
        reject(new Error("Abnormal status code" + res.statusCode));
      } else {
        // parse the http response, store info into the var "payload"
        body = JSON.parse(body);
        var payload = {
          errMsg: body["errmsg"],
          isContinue: body["is_continue"],
          count: body["count"]
        };
        var msgList = [];
        if (body["general_msg_list"]) {
          var list = JSON.parse(body["general_msg_list"]).list;
          for (var i in list) {
            // only scrape the app_msg with article & images ("图文消息")
            if (list[i]["comm_msg_info"]["type"] === 49) {
              __parseMsgListItem(list[i], msgList, keyword);
            }
          }
          // store the last msgId for the next scraping
          msgList.push({
            msgId: list[list.length - 1]["comm_msg_info"]["id"],
            datetime: list[list.length - 1]["comm_msg_info"]["datetime"]
          });
          payload.msgList = msgList;
          resolve(payload);
        } else {
          reject(new Error("The key is expired"));
        }
      }
    });
  });
}

/**
 * function __parseMsgListItem
 * @description parse the item in the msg list
 * 
 * @param {Object} msgListItem , an item in the msg list
 * @param {Array} msgList , the array that store all the result msg
 * @param {String} [keyword] , the keyword which should be in the title of the msg, optional
 */
function __parseMsgListItem(msgListItem, msgList, keyword) {
  var datetime = new Date(msgListItem["comm_msg_info"]["datetime"] * 1000);
  var msgId = msgListItem["comm_msg_info"]["id"];
  var msgExtInfo = msgListItem["app_msg_ext_info"];
  if (!keyword || keyword && msgExtInfo["title"].indexOf(keyword) >= 0) {
    // store the main msg of the list item
    msgList.push({
      msgId: msgId,
      author: msgExtInfo["author"],
      title: msgExtInfo["title"],
      contentUrl: msgExtInfo["content_url"],
      datetime: datetime
    });
  }
  if (msgExtInfo["is_multi"] === 1) {
    // store the multi msg of the list item
    var multiItemList = msgExtInfo["multi_app_msg_item_list"];
    for (var j in multiItemList) {
      if (!keyword || multiItemList[j]["title"].indexOf(keyword) >= 0) {
        msgList.push({
          msgId: msgId,
          author: multiItemList[j]["author"],
          title: multiItemList[j]["title"],
          contentUrl: multiItemList[j]["content_url"],
          datetime: datetime
        });
      }
    }
  }
}

/**
 * function saveMsg
 * @description get the html page and save all the info of a msg into database
 * 
 * @param {Object} msgItem 
 * - {String} msgId
 * - {String} author
 * - {String} title
 * - {String} contentUrl
 * - {Number} datetime
 * 
 * @return {Promise} result, an Message object
 * e.g. {
 *  "author": "七言君"
 *  "title": "七言|我遇见你。"
 *  "url": "http://mp.weixin.qq.com/s?__biz=MjM5NTAyODc2MA==&mid=2654407533&idx=4&sn=b6a140005a06418fcd422fb402290564&chksm=bd3d611a8a4ae80cf5cb7d558b4c1953d88ee476b9d422e8e1b6fd5c7e31e909652850c7d9a7&scene=0&ascene=7&devicetype=android-22&version=26050732&nettype=WIFI&abtest_cookie=AQABAAgAAQCFhh4AAAA%3D&pass_ticket=1FakfvnUimkjltYx1OZN3tmpfFVKW3oldKtL7ZrE1BR9fPl1BjAPfPUDBOWS7bof&wx_header=1",
 *  "html": "...",
 *  "datetime": 1491581568
 * }
 */
function saveMsg(msgItem) {
  return new Promise(function (resolve, reject) {
    // check if the msg exists
    var msgExists = false;
    __checkMsgExistence(msgItem).then(function (result) {
      if (result) {
        msgExists = true;
      } else {
        // get the html of the msg page
        msgExists = false;
        console.log("Processing message:", msgItem.title);
        return __getMsgHtml(msgItem.contentUrl);
      }
    }).then(function (html) {
      if (!msgExists) {
        // save the info into database
        return __createMsg(msgItem, html);
      }
    }).then(function () {
      resolve();
    }, function (err) {
      reject(err);
    });
  });
}

/**
 * function __checkMsgExistence
 * @description check if the msg was saved in the database already
 * 
 * @param {Object} msgItem
 * - {String} msgId
 * - {String} author
 * - {String} title
 * - {String} contentUrl
 * - {Number} datetime
 */
function __checkMsgExistence(msgItem) {
  return new Promise(function (resolve, reject) {
    Message.findOne({
      msgId: msgItem.msgId,
      title: msgItem.title,
      author: msgItem.author,
      url: msgItem.contentUrl,
      datetime: msgItem.datetime
    }).exec().then(function (result) {
      if (result) {
        resolve(true);
      } else {
        resolve(false);
      }
    }, function (err) {
      reject(err);
    });
  });
}

/**
 * function __getMsgHtml
 * @description get the html of a msg page
 * 
 * @param {String} url , the url of the msg page 
 * 
 * @return {Promise} body, the html of the msg page
 */
function __getMsgHtml(url) {
  return new Promise(function (resolve, reject) {
    request(url, function (err, res, body) {
      if (err) {
        reject(err);
      } else if (res.statusCode !== 200) {
        reject(new Error("Abnormal status code" + res.statusCode));
      } else {
        resolve(body);
      }
    });
  });
}

/**
 * function __createMsg
 * @description create a Message record in the database
 * 
 * @param {Object} msgItem 
 * - {String} msgId
 * - {String} author
 * - {String} title
 * - {String} contentUrl
 * - {Number} datetime
 * @param {String} html
 * 
 * @return {Promise} result, a Message record object
 */
function __createMsg(msgItem, html) {
  return new Promise(function (resolve, reject) {
    Message.create({
      msgId: msgItem.msgId,
      author: msgItem.author,
      title: msgItem.title,
      url: msgItem.contentUrl,
      html: html,
      datetime: msgItem.datetime
    }).then(function (result) {
      resolve(result);
    }, function (err) {
      reject(err);
    });
  });
}