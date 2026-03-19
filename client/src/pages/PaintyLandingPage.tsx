import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function PaintyLandingPage() {
  const [contactEmail, setContactEmail] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-400 flex flex-col items-center justify-center p-6">
      <header className="w-full max-w-4xl text-center mb-12">
        <h1 className="text-5xl font-extrabold text-yellow-900 mb-4">Painty</h1>
        <p className="text-xl text-yellow-800">Professional Painting Services for Your Home & Business</p>
      </header>

      <main className="w-full max-w-3xl bg-white rounded-lg shadow-lg p-8">
        <section className="mb-8">
          <h2 className="text-3xl font-bold text-yellow-900 mb-4">Our Services</h2>
          <ul className="list-disc list-inside text-yellow-800 space-y-2">
            <li>Interior & Exterior Painting</li>
            <li>Residential & Commercial Projects</li>
            <li>Custom Color Matching</li>
            <li>Wallpaper Removal & Surface Preparation</li>
            <li>Eco-Friendly Paint Options</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-3xl font-bold text-yellow-900 mb-4">Why Choose Painty?</h2>
          <ul className="list-disc list-inside text-yellow-800 space-y-2">
            <li>Experienced & Licensed Painters</li>
            <li>High-Quality Materials & Equipment</li>
            <li>Competitive Pricing & Free Estimates</li>
            <li>Flexible Scheduling & Timely Completion</li>
            <li>100% Satisfaction Guarantee</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-3xl font-bold text-yellow-900 mb-4">Get a Free Quote</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert(`Thank you for contacting Painty! We will reach out to you at ${contactEmail}.`);
              setContactEmail("");
            }}
            className="flex flex-col gap-4 max-w-md mx-auto"
          >
            <label htmlFor="email" className="text-yellow-900 font-semibold">
              Your Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@example.com"
              className="border border-yellow-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-white">
              Request Quote
            </Button>
          </form>
        </section>
      </main>

      <footer className="mt-12 text-center text-yellow-900">
        &copy; {new Date().getFullYear()} Painty. All rights reserved.
      </footer>
    </div>
  );
}
