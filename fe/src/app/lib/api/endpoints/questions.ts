import { z } from "zod";

import { questionSchema } from "../../../types/api";
import { api } from "../client";

export const questionsByProduct = (productId: string) =>
  api.get(
    `/questions/product/${encodeURIComponent(productId)}`,
    z.array(questionSchema),
    undefined,
    { auth: false },
  );

export interface AskQuestionInput {
  productId: string;
  question: string;
}

export const askQuestion = (body: AskQuestionInput) => api.post("/questions", questionSchema, body);

export const answerQuestion = (id: string, body: { answer: string }) =>
  api.put(`/questions/${encodeURIComponent(id)}/answer`, questionSchema, body);
