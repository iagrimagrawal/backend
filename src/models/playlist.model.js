import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    videos:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:"Video"
        }
    ],
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }
},{
    timestamps:true
});

playlistSchema.index({ owner:1, name:1 }, { unique:true }); 
export const Playlist = mongoose.model("Playlist",playlistSchema);