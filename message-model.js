var mongoose = require("mongoose");
mongoose.Promise = global.Promise;

module.exports = MessageModel();

/**
 * MessageModel
 * @description generate the Message model to query mongoDB
 */
function MessageModel() {
  // the schema of Message
  var messageSchema = mongoose.Schema({
    msgId: Number,
    title: String,
    author: String,
    url: String,
    html: String,
    datetime: Date
  });
  // the Message model
  var Message = mongoose.model("Message", messageSchema);

  return Message;
}