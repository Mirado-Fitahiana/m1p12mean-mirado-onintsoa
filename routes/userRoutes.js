const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// Route d'inscription
router.post(
  "/register",
  [
    body("nom").notEmpty().withMessage("Le nom est obligatoire"),
    body("adresseMail").isEmail().withMessage("Email invalide"),
    body("numeroTel").notEmpty().withMessage("Numéro obligatoire"),
    body("password").isLength({ min: 6 }).withMessage("Le mot de passe doit contenir au moins 6 caractères"),
    body("role").isIn(["ADMIN", "CLIENT", "MECANICIEN"]).withMessage("Rôle invalide"),
    body("adresse").notEmpty().withMessage("adresse est obligatoire"),
    body("CIN").notEmpty().withMessage("CIN est obligatoire"),
    body("dateDeNaissance").notEmpty().withMessage("Date de naissance obligatoire"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { nom, adresseMail, numeroTel, password, role, adresse, CIN, dateDeNaissance } = req.body;

      // Vérifier si l'utilisateur existe déjà
      let user = await User.findOne({ adresseMail });
      if (user) return res.status(400).json({ message: "Cet email est déjà utilisé" });

      user = new User({ nom, adresseMail, numeroTel, password, role, adresse, CIN, dateDeNaissance });
      await user.save();

      res.status(201).json({ message: "Utilisateur créé avec succès !" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Route de connexion
router.post(
    "/login",
    [
      body("adresseMail").notEmpty().withMessage("Email requis"),
      body("password").notEmpty().withMessage("Le mot de passe est obligatoire")
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
      try {
        const { adresseMail, password } = req.body;
  
        const isEmail = /\S+@\S+\.\S+/.test(adresseMail);
  
        const user = await User.findOne(isEmail ? { adresseMail: adresseMail } : { numeroTel: adresseMail });
  
        if (!user) return res.status(400).json({ message: "Utilisateur non trouvé" });
  
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: "Mot de passe incorrect" });
  
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "10h" });
        console.log(token);
        res.json({ token, user: { id: user._id, nom: user.nom, role: user.role } });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
  

// Récupérer le profil utilisateur ou la liste des utilisateurs
router.get("/:id?", async (req, res) => {
  try {
    let userId = req.params.id || req.user?.id;

    if (userId) {
      const user = await User.findById(userId).select("-password");
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      return res.json(user);
    }
    const users = await User.find().select("-password");
    res.json(users);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Récupérer le profil utilisateur ou la liste des utilisateurs
router.get("/role/:role?", async (req, res) => {
  try {
      const user = await User.find({role: req.params.role});
      if (!user) return res.status(404).json({ message: "Rôle non trouvé" });

      return res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un utilisateur (protégé par JWT)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params; // Récupérer l'ID depuis l'URL
    const { nom, adresseMail, numeroTel, photo, CIN, adresse, dateDeNaissance } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { nom, adresseMail, numeroTel, photo, CIN, adresse, dateDeNaissance  },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json({ message: "Utilisateur mis à jour", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Supprimer un utilisateur (protégé par JWT)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Utilisateur supprimé !" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Compter le nombre de mécaniciens
router.get("/mecaniciens/count", async (req, res) => {
  try {
      // Recherche des utilisateurs avec le rôle "MECANICIEN"
      const users = await User.find({ role: "MECANICIEN" });

      // Vérifie si la requête a trouvé des utilisateurs
      if (!users) return res.status(404).json({ message: "Aucun mécanicien trouvé" });

      // Retourne le nombre total de mécaniciens
      const count = users.length;
      return res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
