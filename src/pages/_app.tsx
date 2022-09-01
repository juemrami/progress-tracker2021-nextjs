import React from "react";
import Head from "next/head";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "../../styles/theme";
import { httpBatchLink } from "@trpc/client/links/httpBatchLink";
import { loggerLink } from "@trpc/client/links/loggerLink";
import { withTRPC } from "@trpc/next";
import { AppType } from "next/dist/shared/lib/utils";
import superjson from "superjson";
import { MainLayout } from "../layouts/mainLayout";
import { AppRouter } from "@server/routers/_app";
import trpc, { SSRContext } from "src/client/trpc";
import { ReactQueryDevtools } from "react-query/devtools";
import { SessionProvider } from "next-auth/react";
import { splitLink } from "@trpc/client/links/splitLink";
import { httpLink } from "@trpc/client/links/httpLink";
import "../../styles/globals.css";
import { useRouter } from "next/router";
import { IncomingHttpHeaders } from "http2";
import { Session } from "next-auth/core/types";

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
  const {
    data: auth_data,
    error,
    isError,
    isLoading
  } = trpc.useQuery(["next-auth.get_session"], {
    context: { skipBatch: true },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: typeof window !== "undefined",
    // 5 minutes in milliseconds
    staleTime: 5 * 60 * 1000,
    // retryOnMount: false,
    onError(error) {
      if (
        error?.data?.code === "UNAUTHORIZED" &&
        isError &&
        router.pathname !== "/"
      ) {
        router.reload();
      }
    },
  });
  // trpc.useQuery(["exercise.public.directory"], {
  //   context: { skipBatch: true },
  //   refetchOnWindowFocus: false,
  //   refetchOnMount: false,
  //   refetchOnReconnect: false,
  //   retry: false,
  // });
  const utils = trpc.useContext();
  React.useMemo(() => {
    if (utils && typeof window !== "undefined") {
      // console.log("setting react-query defaults");
      utils.queryClient.setDefaultOptions({
        queries: {
          retry(failureCount, error: any) {
            if (
              (error.data?.code === "UNAUTHORIZED" &&
                error.message.includes("NO_SESSION")) ||
              failureCount > 1
            ) {
              console.log("Session not found invalidating client session")
              utils.queryClient.invalidateQueries(["next-auth.get_session"], {
                refetchInactive: true
              });
              return false;
            }
            return true;
          }
        }
      });
    }
  }, []);
  const router = useRouter();
  const _session = React.useRef(auth_data);
  const session = React.useMemo(() => {
    if (auth_data) {
      _session.current = auth_data;
      return _session.current;
    }
    if (error?.message?.includes("NO_SESSION")) {
      return undefined;
    }
    return _session.current;
  }, [auth_data, error]);
  return (

    <AuthContext.Provider value={{ session: session }} >
      <Head >
        <title>ExBuddy</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head >
      <MainLayout>
        <Component {...pageProps} />
      </MainLayout>
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </AuthContext.Provider>

  )
};
// App.getInitialProps = async ({ ctx }) => {
//   return {
//     emotionCache: clientSideEmotionCache,
//     pageProps: {
//       session: await getSession(ctx)
//     }

//   }
// }
function getBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
  // reference for vercel.com
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // // reference for render.com
  // if (process.env.RENDER_INTERNAL_HOSTNAME) {
  //   return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  // }

  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
export default withTRPC<AppRouter>({
  config({ ctx }) {
    /**
     * If you want to use SSR, you need to use the server's full URL
     * @link https://trpc.io/docs/ssr
     */
    return {
      /**
       * @link https://trpc.io/docs/links
       */
      links: [
        // adds pretty logs to your console in development and logs errors in production
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error)
        }),

        // adds opt-out support for batching
        splitLink({
          condition(operation) {
            return operation.context.skipBatch === true;
          },
          false: httpBatchLink({
            url: `${getBaseUrl()}/api/trpc`
          }),
          true: httpLink({
            url: `${getBaseUrl()}/api/trpc`
          })
        })
      ],
      transformer: superjson,
      /**
       * @link https://react-query.tanstack.com/reference/QueryClient
       */

      queryClientConfig: {},
      headers: () => {
        //on ssr forward cookies to the server to check for auth sessions
        const client_headers: IncomingHttpHeaders | undefined = ctx?.req?.headers;

        // console.log("auth: ", client_headers?.authorization);

        if (client_headers) {
          return {
            cookie: client_headers?.cookie,
            "x-ssr": "1"
          };
        } else return {};
      }
    };
  },
  /**
   * @link https://trpc.io/docs/ssr
   */
  ssr: true,
  /**
   * Set headers or status code when doing SSR
   */
  responseMeta(opts) {
    const ctx = opts.ctx as SSRContext;
    if (ctx.status) {
      // If HTTP status set, propagate that
      return {
        status: ctx.status
      };
    }
    const error = opts.clientErrors[0];
    if (error) {
      // const host_url = ctx.req?.headers?.host ?? getBaseUrl();
      // if (error.message.includes("NO_SESSION") && opts.ctx.asPath !== "/") {
      //   console.log("No sessions found should reroute to: ", host_url);
      //   return {
      //     status: 303, //"SEE_OTHER"
      //     headers: {
      //       location: '/api/auth/signin'
      //     }
      //   };
      // }
      // Propagate http first error from API calls
      return {
        status: error.data?.httpStatus ?? 500
      };
    }
    // For app caching with SSR see https://trpc.io/docs/caching
    // if (opts.)
    return {};
  }
})(App);
