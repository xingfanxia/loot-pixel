import Vault from "@/components/Vault";
import { loadDeckSources } from "@/lib/vault/decks/sources.server";

export default function Home() {
  // Read at build time (static page): the art track's deck descriptions under art/.
  return <Vault sources={loadDeckSources()} />;
}
