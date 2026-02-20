import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { generateToken } from "../utils/token.js";

function isAdminEmail(email) {
  const configured = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(String(email || "").toLowerCase());
}

function safeUserResponse(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role || "USER",
    dob: user.dob,
    currentAddress: user.currentAddress || "",
    permanentAddress: user.permanentAddress || "",
    pan: user.pan || "",
    aadhaar: user.aadhaar || "",
    employmentType: user.employmentType || "",
    monthlyIncome: Number(user.monthlyIncome || 0),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
  };
}

function parseOptionalProfileData(payload = {}) {
  const parsed = {};

  if (typeof payload.dob === "string") {
    if (!payload.dob.trim()) {
      parsed.dob = null;
    } else {
      const parsedDate = new Date(payload.dob);
      if (!Number.isNaN(parsedDate.getTime())) {
        parsed.dob = parsedDate;
      }
    }
  }

  if (typeof payload.currentAddress === "string") {
    parsed.currentAddress = payload.currentAddress.trim();
  }

  if (typeof payload.permanentAddress === "string") {
    parsed.permanentAddress = payload.permanentAddress.trim();
  }

  if (typeof payload.pan === "string") {
    parsed.pan = payload.pan.trim().toUpperCase();
  }

  if (typeof payload.aadhaar === "string") {
    parsed.aadhaar = payload.aadhaar.replace(/\D/g, "").slice(0, 12);
  }

  if (typeof payload.employmentType === "string") {
    parsed.employmentType = payload.employmentType.trim();
  }

  if (payload.monthlyIncome !== undefined) {
    const monthlyIncome = Number(payload.monthlyIncome);
    if (Number.isFinite(monthlyIncome) && monthlyIncome >= 0) {
      parsed.monthlyIncome = monthlyIncome;
    }
  }

  return parsed;
}

export async function signup(req, res) {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "Name, email, phone, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const optionalProfile = parseOptionalProfileData(req.body);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: isAdminEmail(normalizedEmail) ? "ADMIN" : "USER",
      ...optionalProfile,
    });

    const token = generateToken({ id: user._id });

    return res.status(201).json({
      message: "Signup successful",
      token,
      user: safeUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed", error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (isAdminEmail(user.email) && user.role !== "ADMIN") {
      user.role = "ADMIN";
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({ id: user._id });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: safeUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
}

export async function getMe(req, res) {
  try {
    return res.status(200).json({ user: safeUserResponse(req.user) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
}

export async function updateMe(req, res) {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, email, phone } = req.body;

    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (trimmedName.length < 2) {
        return res.status(400).json({ message: "Name must be at least 2 characters" });
      }
      user.name = trimmedName;
    }

    if (typeof phone === "string") {
      user.phone = phone.trim();
    }

    if (typeof email === "string") {
      const normalizedEmail = email.toLowerCase().trim();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email is required" });
      }

      if (normalizedEmail !== user.email) {
        const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
        if (duplicate) {
          return res.status(409).json({ message: "Email already registered" });
        }
        user.email = normalizedEmail;
      }

      if (isAdminEmail(normalizedEmail)) {
        user.role = "ADMIN";
      }
    }

    const optionalProfile = parseOptionalProfileData(req.body);
    Object.assign(user, optionalProfile);

    await user.save();

    return res.status(200).json({
      message: "Profile updated",
      user: safeUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
}
