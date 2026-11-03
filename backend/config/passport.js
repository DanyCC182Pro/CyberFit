const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const callbackURL = process.env.GOOGLE_CALLBACK_URL || `http://localhost:${process.env.PORT || 3000}/api/auth/google/callback`;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL,
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (user) return done(null, user);

    const emailEntry = profile.emails && profile.emails[0];
    const email = emailEntry && emailEntry.value ? emailEntry.value.toLowerCase() : null;
    const verified = Boolean(emailEntry && (emailEntry.verified === true || emailEntry.verified === 'true'));
    if (!email || !verified) return done(new Error('Google no proporcionó un correo verificado'), null);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Solo se vincula a un correo recibido como verificado por Google.
      existingUser.googleId = profile.id;
      if (!existingUser.profileImage && profile.photos?.[0]?.value) existingUser.profileImage = profile.photos[0].value;
      await existingUser.save();
      return done(null, existingUser);
    }

    user = await User.create({
      name: profile.displayName || 'Usuario CyberFit',
      email,
      provider: 'google',
      googleId: profile.id,
      role: 'user',
      profileImage: profile.photos?.[0]?.value || null,
    });
    return done(null, user);
  } catch (error) { return done(error, null); }
}));

passport.serializeUser((user, done) => done(null, user._id.toString()));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); } catch (error) { done(error, null); }
});

module.exports = passport;
