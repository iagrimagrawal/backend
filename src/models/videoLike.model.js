import mongoose from "mongoose";

const videoLikeSchema = new mongoose.Schema({
    video:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Video",
        required:true
    },
    likedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    }
},{
    timestamps:true
});

// prevent duplicate likes
videoLikeSchema.index({ video:1, likedBy:1 }, { unique:true });

export const VideoLike = mongoose.model("VideoLike",videoLikeSchema);