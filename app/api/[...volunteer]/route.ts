import { env } from "cloudflare:workers";
import { handleVolunteerRequest } from "../../../lib/volunteer-service.mjs";

export const GET = (request: Request) => handleVolunteerRequest(request, env);
export const POST = (request: Request) => handleVolunteerRequest(request, env);
