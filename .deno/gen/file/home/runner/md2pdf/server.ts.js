import { serve } from "https://deno.land/std@0.141.0/http/mod.ts";
import { serveDir } from "https://deno.land/std@0.141.0/http/file_server.ts";
serve((req)=>serveDir(req, {
        showDirListing: true
    }));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvbWQycGRmL3NlcnZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBzZXJ2ZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xNDEuMC9odHRwL21vZC50c1wiO1xuaW1wb3J0IHsgc2VydmVEaXIgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTQxLjAvaHR0cC9maWxlX3NlcnZlci50c1wiO1xuc2VydmUoKHJlcSk9PnNlcnZlRGlyKHJlcSx7c2hvd0Rpckxpc3Rpbmc6dHJ1ZX0pKTsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxLQUFLLFFBQVEsNENBQTRDO0FBQ2xFLFNBQVMsUUFBUSxRQUFRLG9EQUFvRDtBQUM3RSxNQUFNLENBQUMsTUFBTSxTQUFTLEtBQUk7UUFBQyxnQkFBZSxJQUFJO0lBQUEifQ==