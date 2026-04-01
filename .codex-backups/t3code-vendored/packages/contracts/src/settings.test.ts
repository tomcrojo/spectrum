import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  ClientSettingsSchema,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_FOLLOW_UP_BEHAVIOR,
} from "./settings";

describe("ClientSettingsSchema", () => {
  it("defaults follow-up behavior to steer", () => {
    const decoded = Schema.decodeSync(ClientSettingsSchema)({});

    expect(decoded.followUpBehavior).toBe("steer");
    expect(DEFAULT_FOLLOW_UP_BEHAVIOR).toBe("steer");
    expect(DEFAULT_CLIENT_SETTINGS.followUpBehavior).toBe("steer");
  });

  it("accepts persisted queue follow-up behavior", () => {
    const decoded = Schema.decodeSync(ClientSettingsSchema)({
      followUpBehavior: "queue",
    });

    expect(decoded.followUpBehavior).toBe("queue");
  });
});
