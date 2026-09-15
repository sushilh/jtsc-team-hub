import { handleVolunteerRequest } from "../../../lib/volunteer-service.mjs";

export const GET = (request: Request) => handleVolunteerRequest(request);
export const POST = (request: Request) => handleVolunteerRequest(request);
