import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    status: "healthy",
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || "development"
                },
                "Healthcheck passed"
            )
        );
})

export {
    healthcheck
    }
    
