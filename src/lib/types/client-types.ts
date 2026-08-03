import { z } from "zod";
import { ClientSchema } from "../zod-schema/client-zod-schema";
import { clients } from "@/db/schema";
import { PaginationMetadata } from "@/lib/types/shared-types";

export type ClientDTO = z.infer<typeof ClientSchema>;
export type Client = typeof clients.$inferSelect;

export type FetchedClients = {
    data: ClientDTO[];
    meta: PaginationMetadata;
};
