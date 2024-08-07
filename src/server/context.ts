/* eslint-disable @typescript-eslint/no-unused-vars */

// context holds data that all of your tRPC procedures will have access to.
// It's a great place to put things like database connections or authentication information.

// Setting up the context is done in 2 steps, defining the type during initialization
// and then creating the runtime context for each request.
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { type Session } from "next-auth";
import { unstable_getServerSession as getServerSession } from "next-auth";
import { nextAuthOptions } from "../pages/api/auth/[...nextauth]";
import { TRPCError, inferAsyncReturnType } from "@trpc/server";
import { NextApiRequest, NextApiResponse } from "next";
// import { PrismaClient } from "@prisma/client";

//using getSession is slower than getServerSession 

/**
 * Uses faster "getServerSession" in next-auth v4 that avoids a fetch request to /api/auth.
 * This function also updates the session cookie whereas getSession does not
 * Note: If no req -> SSG is being used -> no session exists (null)
 * @link https://github.com/nextauthjs/next-auth/issues/1535
 */

// eslint-disable-next-line @typescript-eslint/no-empty-interface
// type a = ReturnType<typeof useSession>;
// type b = Pick<a, "data">;
// type session = NonNullable<b["data"]>;
interface CreateContextOptions {
  session?: Session,
  req?: NextApiRequest,
  res?: NextApiResponse<any>
}


/**
 Step 1: Define the context type 
 
 * Inner function for `createContext` where we create the context.
 * This is useful for testing when we don't want to mock Next.js' request/response
 */
export async function createContextInner(_opts: CreateContextOptions) {
  let session = _opts.session;
  // If the route is public, we don't need a session, return copy of next options
  if (typeof _opts.req?.query.trpc === "string" && _opts.req?.query.trpc.includes("public")) {
    return { ..._opts }
  }

  // console.log("Actually in SSR session", await getServerSession({ req: _opts.req, res: _opts.res }, nextAuthOptions));
  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "NO_SESSION. No auth session found for incoming request.",
    });
  }
  // next-auth didn't have a way to make user_id inferrable from the actual `session` return type. 
  // const user = session.user as any as User;
  return {
    ..._opts,
    session,
  };
}
export type TRPCClientCtx = inferAsyncReturnType<typeof createContextInner>;


/**
 * Step 2: Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export async function createTRPCClientContext(opts: CreateNextContextOptions): Promise<TRPCClientCtx> {
  // for API-response caching see https://trpc.io/docs/caching
  console.log("[trpc Handler] Preparing trpc procedures context for trpc request: ", opts.req.query.trpc);
  console.debug("[trpc Handler] Information incoming to server: ", {query: opts.req.query, cookies: opts.req.cookies});


  // innerContext usefull for testing purposes to mock req/res
  // const ctx = await createContextInner({ session, req: opts.req, res: opts.res });

  // check first for public routes (move to this to procedure level)
  if (typeof opts.req.query.trpc === "string" && opts.req.query.trpc.includes("public")) {
    console.log("[trpc Handler] Public API route detected! no session needed!");
    return {
      ...opts,
    }
  }
  // when is sessions non null and when is it null?
  console.log("[trpc Handler] Private API route! using session from next-auth");
  const session = await getServerSession(opts.req, opts.res, nextAuthOptions)
  console.log("[trpc Handler] Session returned from next-auth: ", session);
  // console.log("Creating context from session: ", session)
  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "NO_SESSION. No auth session found for incoming request.",
    });
  }
  const ctx = {
    ...opts,
    session,
  }
  return ctx
}

