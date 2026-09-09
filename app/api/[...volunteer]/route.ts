import { proxyVolunteerRequest } from "../../../lib/volunteer-proxy.mjs";

export const GET = (request: Request) => proxyVolunteerRequest(request);
export const POST = (request: Request) => proxyVolunteerRequest(request);
