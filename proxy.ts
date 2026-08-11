import { NextResponse, type NextRequest } from "next/server";
import { hasBasicAccess } from "./app/lib/basic-auth";

export function proxy(request:NextRequest){if(hasBasicAccess(request.headers.get("authorization"),process.env.INVENTORY_ACCESS_USER,process.env.INVENTORY_ACCESS_PASSWORD))return NextResponse.next();return new NextResponse("Требуется доступ к внутренним инструментам COSMOS",{status:401,headers:{"www-authenticate":'Basic realm="COSMOS Internal Tools", charset="UTF-8"',"cache-control":"no-store","x-robots-tag":"noindex, nofollow"}})}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
