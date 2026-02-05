import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const TraceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.traceId;
  },
);