import csv
import tempfile
import unittest
from pathlib import Path
from db.prepare_finalists import prepare_finalists
from db.prepare_rsvp import phone

class Finalists(unittest.TestCase):
    def fixture(self, directory, mutate=lambda rows: None):
        names = ['Full name','Full Name','Full Name 2','Full Name 3']
        foods = ['Member 1','Member 2','Member 3 (if any)','Member 4 (if any)']
        headers=['Team name',*names,*foods,*['Email Address'+s for s in ['', ' 2',' 3',' 4']],*['Phone Number'+s for s in ['', ' 2',' 3',' 4']]]
        rows=[]
        for index in range(32):
            r=dict.fromkeys(headers,'');r['Team name']=f'Fixture {index+1}'
            for i in range(2):
                suffix='' if i==0 else ' 2'
                r[names[i]]=f'PERSON {index+1} {i+1}';r[foods[i]]='Veg';r['Email Address'+suffix]=f'p{index}-{i}@example.com';r['Phone Number'+suffix]='9876543210'
            r[names[2]]='-';r[names[3]]='-';rows.append(r)
        mutate(rows)
        target=Path(directory)/'source.csv'
        with target.open('w') as output:
            writer=csv.DictWriter(output,fieldnames=headers);writer.writeheader();writer.writerows(rows)
        return target
    def test_dash_is_not_a_participant(self):
        with tempfile.TemporaryDirectory() as directory:
            data=prepare_finalists(self.fixture(directory))
            self.assertEqual(sum(len(t['members']) for t in data['teams']),64)
            self.assertEqual(data['teams'][0]['members'][0]['name'],'Person 1 1')
            self.assertIsNone(data['teams'][0]['members'][0]['college'])
        self.assertEqual(phone('09321320606'),'+919321320606')
    def test_duplicate_and_missing_food_block_import(self):
        for mutate in [lambda rows: rows[0].update({'Member 1':''}),lambda rows: rows[1].update({'Email Address':rows[0]['Email Address']})]:
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(ValueError): prepare_finalists(self.fixture(directory,mutate))
    def test_enrichment_requires_matching_identity(self):
        old={'teams':[{'teamName':'Fixture 1','members':[{'name':'Person 1 1','email':'p0-0@example.com','phone':'+919876543210','college':'DJSCE','yearBranch':'CSE'}]}]}
        with tempfile.TemporaryDirectory() as directory:
            data=prepare_finalists(self.fixture(directory),old)
            self.assertEqual(data['teams'][0]['members'][0]['college'],'DJSCE')
            self.assertIsNone(data['teams'][0]['members'][1]['college'])

if __name__=='__main__': unittest.main()
