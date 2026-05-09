import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import { CommentLike } from "../models/CommentLike.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const pageNumber = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (pageNumber - 1) * pageSize;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid Video ID");
    }

    const video = await Video.findById(videoId).select("owner isPublished");

    if(!video){
        throw new ApiError(404,"Video not found");
    }

    if (!video.isPublished && video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Cannot view comments on a private video");
    }

    const videoObjectId = new mongoose.Types.ObjectId(videoId);

    const [comments, total] = await Promise.all([
        Comment.aggregate([
            {
                $match: {
                    video: videoObjectId
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $skip: skip
            },
            {
                $limit: pageSize
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                fullName: 1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$owner"
            },
            {
                $lookup: {
                    from: "commentlikes",
                    localField: "_id",
                    foreignField: "comment",
                    as: "likes"
                }
            },
            {
                $addFields: {
                    likeCount: { $size: "$likes" },
                    isLiked: {
                        $in: [req.user._id, "$likes.likedBy"]
                    },
                    isOwner: {
                        $eq: ["$owner._id", req.user._id]
                    }
                }
            },
            {
                $project: {
                    likes: 0,
                    __v: 0
                }
            }
        ]),
        Comment.countDocuments({ video: videoId })
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200, {
        comments,
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
    }, "Comments fetched successfully"));

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
        throw new ApiError(400,"Comment should not execeed 500 characters");
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

    await comment.populate("owner", "username fullName avatar");

    console.log("Comment Added Successfully");
    
    res
    .status(201)
    .json(new ApiResponse(201, {
        ...comment.toObject(),
        likeCount: 0,
        isLiked: false,
        isOwner: true
    }, "Comment added successfully"));
    
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

    const updatedComment = await Comment.findOneAndUpdate(
        {_id:commentId,owner:req.user._id},
        {content:content.trim()},
        {new:true}
    ).populate("owner", "username fullName avatar").select("-__v");

    if(!updatedComment){
        throw new ApiError(404,"Content not found or unauthorised");
    }
  
    return res
    .status(200)
    .json(new ApiResponse(200,{
        ...updatedComment.toObject(),
        isOwner: true
    },"Comment updated Succesfully"));

})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment

    const {commentId} = req.params;

    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400,"Invalid Comment Id");
    }

    const comment = await Comment.findOne({
        _id:commentId,
        owner:req.user._id
    });

    if(!comment){
        throw new ApiError(404,"Comment not found or unauthorized");
    }

    await Promise.all([
        comment.deleteOne(),

        CommentLike.deleteMany({
            comment:commentId,
        })
    ])

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
