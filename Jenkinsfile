pipeline {
    agent any

    stages {
        // stage('Build And Test') {
        //     steps {
        //         container('node') {
        //             sh 'npm ci'
        //             sh 'npm run build'
        //         }
        //     }
        // }



        stage('Deploy To Kubernetes') {
            steps {
                container('jnlp') {
                    // sh 'aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 992256429851.dkr.ecr.us-east-2.amazonaws.com'
                    // sh 'docker build -t demo .'
                    // sh 'docker tag demo:latest 992256429851.dkr.ecr.us-east-2.amazonaws.com/demo:latest'
                    // sh 'docker push 992256429851.dkr.ecr.us-east-2.amazonaws.com/demo:latest'
                    sh 'helm upgrade --install portfolio k8/helm/app --set image.tag=latest -n demo --create-namespace'
                }
            }
        }
    }
}
