import type { ErrorRequestHandler, Request, Response } from "express";
import { ZodError } from "zod";

interface ProblemJson {
  detail: string;
  instance: string;
  status: number;
  title: string;
  type: string;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export function sendProblem(res: Response, problem: ProblemJson): void {
  res.type("application/problem+json").status(problem.status).json(problem);
}

function zodIssueDetail(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join(".") : "request";

      return `${field}: ${issue.message}`;
    })
    .join("; ");
}

export function notFoundHandler(req: Request, res: Response): void {
  sendProblem(res, {
    detail: `No route matched ${req.method} ${req.originalUrl}`,
    instance: req.originalUrl,
    status: 404,
    title: "Not Found",
    type: "about:blank"
  });
}

export const problemJsonErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    sendProblem(res, {
      detail: zodIssueDetail(err),
      instance: req.originalUrl,
      status: 400,
      title: "Invalid Request",
      type: "about:blank"
    });
    return;
  }

  if (err instanceof NotFoundError) {
    sendProblem(res, {
      detail: err.message,
      instance: req.originalUrl,
      status: 404,
      title: "Not Found",
      type: "about:blank"
    });
    return;
  }

  req.log.error({ err }, "Unhandled API error");

  sendProblem(res, {
    detail: "The API encountered an unexpected error.",
    instance: req.originalUrl,
    status: 500,
    title: "Internal Server Error",
    type: "about:blank"
  });
};
