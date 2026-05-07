/**
 * Type stub for SST's `Resource` accessor.
 *
 * SST normally emits these types during `sst deploy` / `sst dev` (it
 * writes a `.sst-env.d.ts` next to the linked resources). Offline CI
 * runs neither, so without this stub `Resource.Rooms.name` would
 * fail to type-check in GitHub Actions.
 *
 * The runtime values come from SST's Lambda glue at deploy time —
 * this file only describes the shape the server expects. Adding a
 * new linked resource means adding a property here.
 */

declare module "sst" {
  interface Resource {
    Rooms: { name: string };
    Connections: { name: string };
    GameWs: { managementEndpoint: string; url: string };
  }
  export const Resource: Resource;
}
