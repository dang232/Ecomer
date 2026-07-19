import { MikroORM } from "@mikro-orm/core";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiResponse } from "./messaging/infrastructure/api-response";

@Controller()
export class AppController {
  constructor(private readonly orm: MikroORM) {}

  @Get("health")
  health(): ApiResponse<{ status: string }> {
    return ApiResponse.ok({ status: "ok" });
  }

  @Get("ready")
  async ready(): Promise<ApiResponse<{ status: string }>> {
    if (!(await this.orm.isConnected())) {
      throw new ServiceUnavailableException("database unavailable");
    }
    return ApiResponse.ok({ status: "ready" });
  }
}
