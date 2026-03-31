import mongoose from "mongoose";
const commentLikeSchema = new mongoose.Schema({
    comment:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Comment",
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

commentLikeSchema.index({ comment:1, likedBy:1 }, { unique:true });

export const CommentLike = mongoose.model("CommentLike",commentLikeSchema);