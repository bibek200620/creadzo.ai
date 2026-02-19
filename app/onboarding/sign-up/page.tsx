"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { backendRequest, setAuthSession, type BackendUser } from "@/lib/backendClient";

const stepContent = [
    { title: "Personal Details", subtitle: "Tell us who you are so we can start your financial profile." },
    { title: "Identity Check", subtitle: "Add PAN and Aadhaar to complete your verification details." },
    { title: "Income Snapshot", subtitle: "Help us estimate your repayment capacity and first credit line." },
] as const;

export default function SignUpPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        dob: "",
        currentAddress: "",
        permanentAddress: "",
        sameAddress: false,
        password: "",
        pan: "",
        aadhaar: "",
        employmentType: "Salaried",
        monthlyIncome: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) => ({
                ...prev,
                [name]: checked,
                permanentAddress: checked ? prev.currentAddress : prev.permanentAddress,
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: value,
            permanentAddress: name === "currentAddress" && prev.sameAddress ? value : prev.permanentAddress,
        }));
    };

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        setStep((prev) => (prev === 1 ? 2 : 3));
    };

    const handleBack = () => {
        setStep((prev) => (prev === 3 ? 2 : 1));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                dob: formData.dob,
                currentAddress: formData.currentAddress,
                permanentAddress: formData.sameAddress ? formData.currentAddress : formData.permanentAddress,
                pan: formData.pan,
                aadhaar: formData.aadhaar,
                employmentType: formData.employmentType,
                monthlyIncome: Number(formData.monthlyIncome || 0),
            };

            const data = await backendRequest<{ token: string; user: BackendUser }>("/auth/signup", {
                method: "POST",
                body: payload,
            });

            setAuthSession(data.token, data.user);
            setIsLoading(false);
            router.push("/");
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : "Signup failed. Please try again.";
            setError(message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen px-4 py-8 md:py-12">
            <div className="mx-auto w-full max-w-4xl">
                <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                    <header className="border-b border-slate-200 bg-slate-50/70 px-6 py-6 sm:px-8">
                        <div className="flex items-center justify-between gap-3">
                            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-teal-700">
                                <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-xs font-bold text-white">CZ</span>
                                Credzo
                            </Link>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Step {step} of 3</p>
                        </div>

                        <h1 className="mt-4 text-3xl font-bold text-slate-900">Create your account</h1>
                        <p className="mt-1 text-sm text-slate-600">{stepContent[step - 1].subtitle}</p>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                            {stepContent.map((item, index) => {
                                const stepNumber = index + 1;
                                const isActive = stepNumber === step;
                                const isDone = stepNumber < step;

                                return (
                                    <div
                                        key={item.title}
                                        className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${
                                            isActive
                                                ? "border-teal-300 bg-teal-50 text-teal-800"
                                                : isDone
                                                    ? "border-teal-200 bg-teal-50/70 text-teal-700"
                                                    : "border-slate-200 bg-white text-slate-500"
                                        }`}
                                    >
                                        {item.title}
                                    </div>
                                );
                            })}
                        </div>
                    </header>

                    <form onSubmit={step === 3 ? handleSubmit : handleNext} className="p-6 sm:p-8">
                        <h2 className="text-xl font-bold text-slate-900">{stepContent[step - 1].title}</h2>

                        {step === 1 && (
                            <div className="mt-5 space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
                                        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ravi Kumar" className="input-field" required />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date of birth</label>
                                        <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="input-field" required />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                                        <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="ravi@example.com" className="input-field" required />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone number</label>
                                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" className="input-field" required />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Current address</label>
                                    <textarea name="currentAddress" value={formData.currentAddress} onChange={handleChange} rows={2} placeholder="Flat, street, city, pincode" className="input-field resize-none" required />
                                </div>

                                <div>
                                    <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <input type="checkbox" id="sameAddress" name="sameAddress" checked={formData.sameAddress} onChange={handleChange} className="h-4 w-4 accent-teal-600" />
                                        Permanent address is same as current
                                    </label>

                                    {!formData.sameAddress && (
                                        <textarea
                                            name="permanentAddress"
                                            value={formData.permanentAddress}
                                            onChange={handleChange}
                                            rows={2}
                                            placeholder="Permanent address"
                                            className="input-field resize-none"
                                            required
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                                    <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Create password" className="input-field" required />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="mt-5 space-y-4">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                    Enter your details exactly as on official IDs. This improves matching quality during profile checks.
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">PAN card number</label>
                                    <input
                                        type="text"
                                        name="pan"
                                        value={formData.pan}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                                        maxLength={10}
                                        placeholder="ABCDE1234F"
                                        className="input-field font-mono tracking-wide uppercase"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Aadhaar number</label>
                                    <input
                                        type="text"
                                        name="aadhaar"
                                        value={formData.aadhaar}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, aadhaar: e.target.value.replace(/\D/g, "") }))}
                                        maxLength={12}
                                        placeholder="123456789012"
                                        className="input-field font-mono tracking-wide"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="mt-5 space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Employment type</label>
                                    <select name="employmentType" value={formData.employmentType} onChange={handleChange} className="input-field" required>
                                        <option value="Salaried">Salaried</option>
                                        <option value="Self-Employed">Self-employed / business</option>
                                        <option value="Gig Worker">Gig worker</option>
                                        <option value="Student">Student</option>
                                        <option value="Homemaker">Homemaker</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Monthly income (INR)</label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-slate-500">₹</span>
                                        <input
                                            type="number"
                                            name="monthlyIncome"
                                            value={formData.monthlyIncome}
                                            onChange={handleChange}
                                            placeholder="25000"
                                            className="input-field pl-7"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Final check</p>
                                    <p className="mt-2 text-sm text-slate-700">{formData.name || "Name"} | {formData.employmentType}</p>
                                    <p className="mt-1 text-sm text-slate-600">PAN: {formData.pan || "--"} | Aadhaar: {formData.aadhaar || "--"}</p>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex gap-3">
                            {step > 1 && (
                                <button type="button" onClick={handleBack} className="btn-secondary w-1/3 py-3">
                                    Back
                                </button>
                            )}

                            <button type="submit" disabled={isLoading} className="btn-primary flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-60">
                                {isLoading ? "Creating account..." : step === 3 ? "Complete Registration" : "Continue"}
                            </button>
                        </div>

                        {error ? (
                            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </p>
                        ) : null}

                        {step === 1 && (
                            <p className="mt-6 text-center text-sm text-slate-600">
                                Already registered?{" "}
                                <Link href="/onboarding/sign-in" className="font-semibold text-teal-700 hover:text-teal-800">
                                    Sign in
                                </Link>
                            </p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
