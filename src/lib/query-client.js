import { QueryClient, QueryCache } from '@tanstack/react-query';
import { reportSessionExpired, isAuthError } from '@/lib/authErrorStore';
import { isPublicPath } from '@/lib/publicPaths';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
	queryCache: new QueryCache({
		onError: (err) => {
			if (!isPublicPath() && isAuthError(err)) {
				reportSessionExpired();
			}
		},
	}),
});