import mongoose, { Mongoose } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query;
    
})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video

    const {videoId} = req.params;
    const {content} = req.body;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid Video ID");
    }

    if(!content || !content.trim()){
        throw new ApiError(400,"Content is not given");
    }

    if(content.trim().length > 500){
        throw new ApiError(400,"Comment should not execeed 500 words");
    }

    const video = await Video.findById(videoId);
    
    if(!video){
        throw new ApiError(400,"Video not found");
    }

    if (!video.isPublished && video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Cannot comment on a private video");
    }

    const comment = await Comment.create({
        content:content.trim(),
        video:videoId,
        owner:req.user._id
    })

    console.log("Comment Added Successfully");
    
    res
    .status(201)
    .json(new ApiResponse(201, comment, "Comment added successfully"));

})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment

    const {commentId} = req.params;
    const {content} = req.body;

    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400,"Invalid Comment Id");
    }

    if(!content || !content.trim()){
        throw new ApiError(400,"Add Comment");
    }

    if(content.trim().length > 500){
        throw new ApiError(400,"Comment should not execeed 500 words");
    }

    const updateComment = await Comment.findOneAndUpdate(
        {_id:commentId,owner:req.user._id},
        {content},
        {new:true}
    ).select("-__v");

    return res
    .status(200)
    .json(new ApiResponse(200,updateComment,"Comment updated Succesfully"));

})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment

    const {commentId} = req.params;

    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400,"Invalid Comment Id");
    }

    const comment = await Comment.findOneAndDelete({
        _id:commentId,
        owner:req.user._id
    });

    if(!comment){
        throw new ApiError(404,"Comment not found or unauthorized");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,null,"Comment deleted Successfully"));
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}
