import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { VerifyEmailLink } from "./VerifyEmailLink";

/** The page the verification email links to. */
const meta = {
  title: "Components/Forms/VerifyEmailLink",
  component: VerifyEmailLink,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    status: "verifying",
    error: "",
    resending: false,
    resent: false,
    resendError: "",
    onRetry: fn(),
    onResend: fn(),
  },
} satisfies Meta<typeof VerifyEmailLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/** While the token is sent to the API. */
export const Verifying: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Confirmando seu e-mail...");
  },
};

/** The email is confirmed and the way to the login is offered. */
export const Verified: Story = {
  args: { status: "verified" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("E-mail confirmado.");
    await expect(canvas.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/entrar");
  },
};

/** An invalid or expired link: a bad address is pointed out; a good one asks for a new link. */
export const Invalid: Story = {
  args: { status: "invalid" },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Este link é inválido ou expirou.");

    await userEvent.type(canvas.getByLabelText("E-mail"), "sem-arroba");
    await userEvent.click(canvas.getByRole("button", { name: "Enviar novo link" }));
    await expect(canvas.getByLabelText("E-mail")).toHaveAccessibleDescription("Informe um e-mail válido.");
    await expect(args.onResend).not.toHaveBeenCalled();

    await userEvent.clear(canvas.getByLabelText("E-mail"));
    await userEvent.type(canvas.getByLabelText("E-mail"), "maria@uefs.br");
    await userEvent.click(canvas.getByRole("button", { name: "Enviar novo link" }));
    await expect(args.onResend).toHaveBeenCalledWith("maria@uefs.br");
  },
};

/** Opened without a token (a truncated link). */
export const MissingToken: Story = {
  args: { status: "missing-token" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("O link de confirmação está incompleto.");
    await expect(canvas.getByLabelText("E-mail")).toBeInTheDocument();
  },
};

/** While the new link is requested, the button says so and is disabled. */
export const Resending: Story = {
  args: { status: "invalid", resending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Enviando..." })).toBeDisabled();
  },
};

/** After requesting a new link the form gives way to the same answer for every address. */
export const Resent: Story = {
  args: { status: "invalid", resent: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Se o e-mail estiver cadastrado, enviamos um novo link");
    await expect(canvas.queryByLabelText("E-mail")).not.toBeInTheDocument();
  },
};

/** Requesting the new link failed: the reason is shown and the form stays. */
export const ResendFailed: Story = {
  args: { status: "invalid", resendError: "Não foi possível enviar o novo link. O servidor encontrou um erro." },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("alert")[1]).toHaveTextContent("Não foi possível enviar o novo link.");
  },
};

/** The API could not be reached: the reason is shown and the person can try again. */
export const Failed: Story = {
  args: { status: "failed", error: "Não foi possível confirmar o e-mail. Não foi possível falar com o servidor." },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Não foi possível confirmar o e-mail.");
    await userEvent.click(canvas.getByRole("button", { name: "Tentar de novo" }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
