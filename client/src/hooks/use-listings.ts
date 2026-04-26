import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type GenerateRequest } from "@shared/routes";

export function useListings() {
  return useQuery({
    queryKey: [api.listings.list.path],
    queryFn: async () => {
      const res = await fetch(api.listings.list.path);
      if (!res.ok) throw new Error("Failed to fetch listings");
      const data = await res.json();
      return api.listings.list.responses[200].parse(data);
    },
  });
}

export function useListing(id: number | null) {
  return useQuery({
    queryKey: [api.listings.get.path, id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("ID is required");
      const url = buildUrl(api.listings.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch listing");
      const data = await res.json();
      return api.listings.get.responses[200].parse(data);
    },
  });
}

export function useGenerateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: GenerateRequest) => {
      // Validate input before sending
      const validated = api.listings.generate.input.parse(data);
      
      const res = await fetch(api.listings.generate.path, {
        method: api.listings.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate listing");
      }

      const responseData = await res.json();
      return api.listings.generate.responses[200].parse(responseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.listings.list.path] });
    },
  });
}
