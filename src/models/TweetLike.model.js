import mongoose from "mongoose";

const tweetLikeSchema = new mongoose.Schema({
    tweet:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Tweet",
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

tweetLikeSchema.index({ tweet:1, likedBy:1 }, { unique:true });

export const TweetLike = mongoose.model("TweetLike",tweetLikeSchema);