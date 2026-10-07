import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db.prepare_rsvp import college, phone, title

class Normalization(unittest.TestCase):
    def test_college_aliases(self):
        variants = ["DJSCE", "DJ Sanghvi", "D. J. Sanghvi", "Dwarkadas J Sanghvi College of Engineering", "SVKM's Dwarkadas J. Sanghvi College of Engineering"]
        for value in variants:
            self.assertEqual(college(value), "Dwarkadas J. Sanghvi College of Engineering")
        self.assertEqual(college("SHAH & ANCHOR KUTCHHI ENGINEERING COLLEGE"),college("Shah and anchor kutchi engineering college"))
        self.assertEqual(college("VJTI"),college("Veermata Jijabai Technological Institute (VJTI)"))
        self.assertEqual(college("-"), None)
    def test_phone_and_branch(self):
        self.assertEqual(phone("98765 43210"), "+919876543210")
        self.assertEqual(phone(9876543210.0), "+919876543210")
        self.assertEqual(title("2nd year, ai&ds"), "2nd Year, AI&DS")

if __name__ == '__main__': unittest.main()
