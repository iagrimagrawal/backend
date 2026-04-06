import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"
import { Comment } from "../models/comment.model.js"
import { VideoLike } from "../models/videoLike.model.js"
import { CommentLike } from "../models/CommentLike.model.js"
import { Playlist } from "../models/playlist.model.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    //TODO: get all videos based on query, sort, pagination
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body;
    // TODO: get video, upload to cloudinary, create video

    if(!title || !description){
        throw new ApiError(400,"Title and description is required");
    }

    if(!req.files || !req.files.videoFile || !req.files.thumbnail){
        throw new ApiError(400,"Video file and thumbnail are required");
    }

    if(!req.files.videoFile[0].mimetype.startsWith("video/")){
        throw new ApiError(400,"Invalid video file format");
    }

    if(!req.files.thumbnail[0].mimetype.startsWith("image/")){
        throw new ApiError(400,"Invalid thumbnail file format. Thumbnail must be an image");
    }
    
    // get video and thumbnail from req.files
    const videoFileLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
    
    if(!videoFileLocalPath){
        throw new ApiError(400,"Video file is required");
    }

    if(!thumbnailLocalPath){
        throw new ApiError(400,"Thumbnail file is required");
    }

    // upload video and thumbnail to cloudinary
    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if(!videoFile?.url){
        throw new ApiError(400,"videoFile is required");
    }

    if(!thumbnail?.url){
        throw new ApiError(400,"thumbnail is required")
    }

    const video = await Video.create({
        title,
        description,
        owner:req.user._id,
        videoFile:videoFile.url,
        videoFilePublicId:videoFile.public_id,
        thumbnail:thumbnail.url,
        thumbnailPublicId:thumbnail.public_id,
        duration:videoFile.duration || 0,
        views:0,
    });

    console.log("Video publish Succuessfully");

    return res.status(201).json(new ApiResponse(201,video,"video publish Successfull"));
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video id");
    }

    const video = await Video.findByIdAndUpdate(
        {_id:videoId,isPublished:true},
        {$inc:{views:1}},
        {new:true}
    )
    .populate("owner","username fullName avatar")
    .select("-__v");

    if(!video){
        throw new ApiError(404,"Video not found");
    }

    await User.findByIdAndUpdate(req.user._id,{
        $addToSet: {watchHistory:videoId}
    })

    return res
    .status(200)
    .json(new ApiResponse(200,video,"Video details fetch successfull"));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: update video details like title, description, thumbnail
    const {title,description} = req.body;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video id");
    }

    const updateFields = {};
    if(title){
        updateFields.title = title;
    }

    if(description){
        updateFields.description = description;
    }

    const video = await Video.findOne({_id:videoId,owner:req.user._id});

    if(!video){
        throw new ApiError(404,"Video not found or unauthorized");
    }

    if (req.file) {
        if (!req.file.mimetype.startsWith("image/")) {
            throw new ApiError(400, "Invalid thumbnail format");
        }    
        const thumbnailLocalPath = req.file?.path;

        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

        if(!thumbnail.url){
            throw new ApiError(400,"Thumbnail upload fail");
        }

        if(video.thumbnailPublicId){
            await deleteFromCloudinary(video.thumbnailPublicId);
        }

        updateFields.thumbnail = thumbnail.url;
        updateFields.thumbnailPublicId = thumbnail.public_id;
    }

    if(Object.keys(updateFields).length === 0){
        throw new ApiError(400,"At least one field is required to update");
    }

    const updateVideo = await Video.findOneAndUpdate(
        {_id:videoId,owner:req.user._id},
        {$set:updateFields},
        {new:true}
    ).select("-__v");

    return res
    .status(200)
    .json(new ApiResponse(200,updateVideo,"video updated successfully"));

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video id");
    }

    const video = await Video.findOne({
        _id:videoId,
        owner:req.user._id
    });

    if(!video){
        throw new ApiError(404,"Video not found");
    }

    const commentIds = await Comment.find({ video: videoId }).distinct("_id");

    await Promise.all([
        video.deleteOne(),

        User.updateMany(
        {watchHistory: videoId},
        {$pull:{watchHistory:videoId}}
        ),

        Playlist.updateMany(
            {videos:videoId},
            {$pull:{videos:videoId}}
        ),

        VideoLike.deleteMany({ video: videoId }),

        CommentLike.deleteMany({
            comment: { $in: commentIds }
        }),

        Comment.deleteMany({ video: videoId })

    ]);

    await Promise.all([
        video.videoFilePublicId && deleteFromCloudinary(video.videoFilePublicId),
        video.thumbnailPublicId && deleteFromCloudinary(video.thumbnailPublicId)
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200,null,"Video deleted successfully"));

});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video Id");
    }

    const toggleStatusUpdate = await Video.findOneAndUpdate(
        {_id:videoId,owner:req.user._id},
        [
            {
                $set:{
                    isPublished:{
                        $not:"$isPublished"
                    }
                }
            }
        ],
        {updatePipeline:true}
    )

    if(!toggleStatusUpdate){
        throw new ApiError(404,"Video not found or unauthorized");
    }
    return res
    .status(200)
    .json(new ApiResponse(200,toggleStatusUpdate, "Video publish status toggled successfully"));

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}