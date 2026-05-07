import mongoose from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    if (channelId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel");
    }

    const channel = await User.findById(channelId).select("subscriberCount");
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    try {
        // 🔥 try subscribe
        await Subscription.create({
            subscriber: req.user._id,
            channel: channelId
        });

        await Promise.all([
            User.findByIdAndUpdate(channelId, {
                $inc: { subscriberCount: 1 }
            }),
            User.findByIdAndUpdate(req.user._id, {
                $inc: { subscribedToCount: 1 }
            })
        ]);

        return res.status(200).json(
            new ApiResponse(200, {
                isSubscribed: true,
                subscriberCount: channel.subscriberCount + 1
            }, "Subscribed successfully")
        );

    } catch (error) {

        if (error.code === 11000) {
            // 🔥 already subscribed → unsubscribe
            await Subscription.deleteOne({
                subscriber: req.user._id,
                channel: channelId
            });

            await Promise.all([
                User.findByIdAndUpdate(channelId, {
                    $inc: { subscriberCount: -1 }
                }),
                User.findByIdAndUpdate(req.user._id, {
                    $inc: { subscribedToCount: -1 }
                })
            ]);

            return res.status(200).json(
                new ApiResponse(200, {
                    isSubscribed: false,
                    subscriberCount: Math.max(channel.subscriberCount - 1, 0)
                }, "Unsubscribed successfully")
            );
        }

        throw error;
    }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channel = await User.findById(channelId)
        .select("subscriberCount");

    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const subscribers = await Subscription.find({ channel: channelId })
        .populate("subscriber", "fullName username avatar coverImage")
        .select("subscriber createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                subscribers,
                subscriberCount: channel.subscriberCount, // 🔥 from stored value
                page,
                limit
            },
            "Channel subscribers fetched successfully"
        )
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    // 🔐 optional: keep or remove based on your app design
    if (subscriberId !== req.user?._id.toString()) {
        throw new ApiError(403, "Not authorized");
    }

    const user = await User.findById(subscriberId)
        .select("subscribedToCount");

    if (!user) {
        throw new ApiError(404, "Subscriber not found");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const channels = await Subscription.find({ subscriber: subscriberId })
        .populate("channel", "fullName username avatar coverImage")
        .select("channel createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                channels,
                total: user.subscribedToCount, // 🔥 from stored value
                page,
                limit
            },
            "Subscribed channels fetched successfully"
        )
    );
});
export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
