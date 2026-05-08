import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    const [videoStats = {}, totalSubscribers] = await Promise.all([
        Video.aggregate([
            {
                $match: {
                    owner: req.user._id
                }
            },
            {
                $lookup: {
                    from: "videolikes",
                    localField: "_id",
                    foreignField: "video",
                    as: "likes"
                }
            },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                    totalLikes: { $sum: { $size: "$likes" } }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalVideos: 1,
                    totalViews: 1,
                    totalLikes: 1
                }
            }
        ]).then((stats) => stats[0]),
        Subscription.countDocuments({ channel: req.user._id })
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, {
            totalVideos: videoStats.totalVideos || 0,
            totalViews: videoStats.totalViews || 0,
            totalLikes: videoStats.totalLikes || 0,
            totalSubscribers
        }, "Channel stats fetched successfully"));
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const videos = await Video.find({ owner: req.user._id })
        .sort({ createdAt: -1 })
        .populate("owner", "username fullName avatar")
        .select("-__v")
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Channel videos fetched successfully"));
})

export {
    getChannelStats,
    getChannelVideos
}
