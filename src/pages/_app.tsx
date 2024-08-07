import React from "react";
import Head from "next/head";
import { AppType } from "next/dist/shared/lib/utils";
import superjson from "superjson";
import { MainLayout } from "../layouts/mainLayout";
import { appRouter } from "@server/routers/_app";
import trpcNextHooks from "src/client/trpc";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"; 
import "../../styles/globals.css";
import { useRouter } from "next/router";
import { Session } from "next-auth/core/types";
import { GetStaticProps, GetStaticPropsContext } from "next";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { getQueryKey } from "@trpc/react-query";
// interface MyAppProps extends AppProps {
//   emotionCache?: EmotionCache;
//   pageProps: any;
// }
type AuthCtx = {
  session?: Session | null;
}
const AuthContext = React.createContext<AuthCtx>({
  session: undefined,
});
export function useSession() {
  return React.useContext(AuthContext);
}
const App: AppType = ({ pageProps, Component }): JSX.Element => {
  const { data: auth_data, error } = trpcNextHooks.next_auth.get_session
    .useQuery(undefined, {
      trpc: { context: { skipBatch: true } },
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      enabled: typeof window !== "undefined",
      // 5 minutes in milliseconds
      staleTime: 5 * 60 * 1000,
      retryOnMount: false,
  });
  const router = useRouter();
  // One-time use effect to set the react-query client default behaviors
  const sessionRef = React.useRef(auth_data);
  const session = React.useMemo(() => {
    console.log("[_app.tsx] Change in Session detected") 
    
    if (!sessionRef.current && auth_data) {
      sessionRef.current = auth_data; 
      console.log("[_app.tsx] New Session started: ", auth_data);
      return sessionRef.current;
    }
    if (auth_data == sessionRef.current) {
      console.log("[_app.tsx] No session change: ", sessionRef.current);
      return sessionRef.current;
    }
    console.log("[_app.tsx] No session found: ", {auth_data, error});
    return undefined;
  }, [auth_data, error]);

  const appLocation = React.useMemo(() => {
    switch (router.pathname) {
      case "/":
        // set the head title
        return "Welcome!";
      case "/[user]":
        return "Daily Summary";
      case "/[user]/workout/[workout_id]":
        return "Workout Report";
      case "/[user]/workout/history":
        return "Workout History";
      case "/[user]/exercise/[exercise_id]":
        return "Exercise Info";
      default:
        return "404";
    }
  }, [router.pathname]);
  return (
    <AuthContext.Provider value={{ session: session }} >
      <Head >
        <title>{`ExBuddy${appLocation != '404' && (' | ' + appLocation)}`}</title>
        <meta name="viewport" content="initial-scale=1, width=device-width, user-scalable=no" />
      </Head >
      <MainLayout session={session} appLocation={appLocation}>
        <Component {...pageProps} />
      </MainLayout>
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </AuthContext.Provider>
  )
};
const getStaticProps: GetStaticProps = async (ctx: GetStaticPropsContext) => {
  // create a dummy request and response to pass to the server;

  const ssg = await createServerSideHelpers({
    router: appRouter,
    ctx: { session: undefined, },
    transformer: superjson,
  })
  // todo: setup static caching for the exercise directory to improve SEO by keeping all the exercise data in the index page?
  const directoryQueryKey = getQueryKey(trpcNextHooks.exercise.public_directory, undefined, 'query')
  await ssg.queryClient.fetchQuery(directoryQueryKey);
  return {
    props: {
      trpcState: ssg.dehydrate(),
      exerciseDirectory: ssg.queryClient.getQueryData(directoryQueryKey)
    },
    // 1 hour in seconds
    revalidate: 60 * 60,
  }
}

export default trpcNextHooks.withTRPC(App)