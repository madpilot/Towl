/**
 * Tests for LoginScreen.
 * Verifies validation, successful login flow, and error handling.
 */

jest.mock("@/api/auth", () => ({
  login: jest.fn(),
  isAxiosAuthError: jest.fn(),
}));

jest.mock("@/auth/authManager", () => ({
  onLoginSuccess: jest.fn(),
}));

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import LoginScreen from "@/screens/auth/LoginScreen";
import * as authApi from "@/api/auth";
import * as authManager from "@/auth/authManager";

const SERVER_URL = "https://kitchen.local";

const baseProps = {
  navigation: {} as never,
  route: { params: { serverUrl: SERVER_URL } } as never,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("LoginScreen", () => {
  it("renders server URL and form fields", () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen {...baseProps} />,
    );
    expect(getByText(SERVER_URL)).toBeTruthy();
    expect(getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(getByPlaceholderText("••••••••")).toBeTruthy();
  });

  it("shows error when username is empty", async () => {
    const { getByText, getByTestId } = render(<LoginScreen {...baseProps} />);
    await act(async () => {
      fireEvent.press(getByTestId("login-button"));
    });
    expect(getByText("Please enter your username or email.")).toBeTruthy();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("shows error when password is empty", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <LoginScreen {...baseProps} />,
    );
    fireEvent.changeText(getByPlaceholderText("you@example.com"), "alice");
    await act(async () => {
      fireEvent.press(getByTestId("login-button"));
    });
    expect(getByText("Please enter your password.")).toBeTruthy();
  });

  it("calls login and onLoginSuccess on valid credentials", async () => {
    const fakeRes = {
      access_token: "acc",
      refresh_token: "ref",
      user: { id: 1, name: "Alice", username: "alice" },
    };
    (authApi.login as jest.Mock).mockResolvedValue(fakeRes);
    (authManager.onLoginSuccess as jest.Mock).mockResolvedValue(undefined);

    const { getByPlaceholderText, getByTestId } = render(
      <LoginScreen {...baseProps} />,
    );
    fireEvent.changeText(getByPlaceholderText("you@example.com"), "alice");
    fireEvent.changeText(getByPlaceholderText("••••••••"), "secret");
    await act(async () => {
      fireEvent.press(getByTestId("login-button"));
    });

    await waitFor(() =>
      expect(authManager.onLoginSuccess).toHaveBeenCalledWith(
        SERVER_URL,
        "acc",
        "ref",
        fakeRes.user,
      ),
    );
  });

  it("shows invalid credentials error on 401", async () => {
    const axiosErr = { response: { status: 401 } };
    (authApi.login as jest.Mock).mockRejectedValue(axiosErr);
    (authApi.isAxiosAuthError as unknown as jest.Mock).mockReturnValue(true);

    const { getByText, getByPlaceholderText, getByTestId } = render(
      <LoginScreen {...baseProps} />,
    );
    fireEvent.changeText(getByPlaceholderText("you@example.com"), "alice");
    fireEvent.changeText(getByPlaceholderText("••••••••"), "wrong");
    await act(async () => {
      fireEvent.press(getByTestId("login-button"));
    });

    await waitFor(() =>
      expect(getByText("Invalid username or password.")).toBeTruthy(),
    );
  });

  it("shows network error on non-401 failure", async () => {
    (authApi.login as jest.Mock).mockRejectedValue(new Error("Network Error"));
    (authApi.isAxiosAuthError as unknown as jest.Mock).mockReturnValue(false);

    const { getByText, getByPlaceholderText, getByTestId } = render(
      <LoginScreen {...baseProps} />,
    );
    fireEvent.changeText(getByPlaceholderText("you@example.com"), "alice");
    fireEvent.changeText(getByPlaceholderText("••••••••"), "pass");
    await act(async () => {
      fireEvent.press(getByTestId("login-button"));
    });

    await waitFor(() =>
      expect(
        getByText(
          "Could not connect to server. Check your network and try again.",
        ),
      ).toBeTruthy(),
    );
  });
});
