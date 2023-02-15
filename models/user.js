const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    roles: {
        User: {
            type: Number,
            default: 2001
        },
        Editor: Number,
        Admin: Number
    },
    password: {
        type: String,
        required: true
    },
    refreshToken: String
    // username:{
    //     type:String,
    //     required: true,
    //     unique: true
    // },
    // password:{
    //     type: String,
    //     required: true
    // },
    // status:{
    //     type:String ,
    //     // required: true
    // },
    // role:{
    //     type: String,
    //     // required: true 
    // },
    // firstname:{
    //     type:String,
    //     // required: true 
    // }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
module.exports = User;